<?php

namespace App\Services;

use App\Models\User;
use App\Models\Application;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use App\Mail\ApplicationApprovalMail;
use App\Mail\ApplicationProgressMail;
use App\Mail\ApplicationFinalMail;
use App\Mail\ApplicationIdentityApprovedMail;
use App\Mail\ApplicationDeclinedMail;
use App\Mail\ApplicationCorrectionRequiredMail;

class WorkflowLifecycleService
{
    /**
     * Pauses the workflow and sends the application back to the user because their ID card is invalid.
     * 
     * Business Logic:
     * - Records the current step so the workflow can resume exactly where it left off.
     * - Changes the application status to 'id_card_reupload_required'.
     * - Sends an email notification to the applicant.
     * 
     * @param int $applicationId The database ID of the application
     * @param string $remarks Reason for rejecting the ID card
     * @param string $actedBy The user ID of the reviewer rejecting the card
     * @return array Status and message
     */
    public function sendBackForIdCard(int $applicationId, string $remarks, string $actedBy): bool
    {
        return DB::transaction(function () use ($applicationId, $remarks, $actedBy) {
            $app = DB::table('applications')->where('id', $applicationId)->lockForUpdate()->first();
            if (!$app) return false;

            // Check if identity is already approved via application_id_proof_reviews
            $isApproved = DB::table('application_id_proof_reviews')
                ->where('application_id', $applicationId)
                ->where('review_status', 'approved')
                ->exists();
                
            if ($isApproved) {
                throw new \Exception("This application's identity has already been verified and cannot be sent back for correction.");
            }

            // 1. Update Application Status and Metadata
            DB::table('applications')
                ->where('id', $applicationId)
                ->update([
                    'status' => 'id_proof_pending',
                    'paused_workflow_step' => $app->current_step_id,
                    'updated_at' => now(),
                ]);

            DB::table('app_activation_details')
                ->where('application_id', $applicationId)
                ->update([
                    'id_proof_requested_at' => now()
                ]);

            DB::table('application_id_proof_reviews')->insert([
                'application_id' => $applicationId,
                'review_status' => 'reupload_requested',
                'remarks' => $remarks,
                'requested_by' => $actedBy,
                'requested_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // 2. Log the action
            DB::table('application_workflow_logs')->insert([
                'application_id' => $applicationId,
                'workflow_step_id' => $app->current_step_id,
                'action' => 'Sent back for valid ID Card',
                'remarks' => $remarks,
                'action_by' => $actedBy,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Dispatch Email Notification
            $user = DB::table('users')->where('user_id', $app->user_id)->first();
            $profile = DB::table('user_profiles')->where('user_id', $app->user_id)->first();

            if ($user && $user->email) {
                $name = $profile ? ($profile->first_name . ' ' . $profile->last_name) : 'Applicant';
                $reasonsText = "Invalid Identity Card";

                try {
                    Mail::to($user->email)->queue(new ApplicationCorrectionRequiredMail(
                        $name,
                        $app->application_id,
                        $reasonsText,
                        $remarks
                    ));
                } catch (\Exception $e) {
                    Log::error('Failed to send correction email: ' . $e->getMessage());
                }
            }

            return true;
        });
    }

    /**
     * Rejects the application entirely and halts the workflow.
     * 
     * Business Logic:
     * - Marks the current workflow step as 'rejected'.
     * - Updates the application status to 'final_rejected'.
     * - Increments the user's retry count. If retry limit (3) is hit, the user is blocked.
     * - Emails the applicant regarding the rejection.
     * 
     * @param int $applicationId The database ID of the application
     * @param string $remarks Rejection reasoning
     * @param string $actedBy The user ID of the reviewer rejecting the application
     * @return array Status and message
     */
    public function finalReject(int $applicationId, string $remarks, string $actedBy): bool
    {
        return DB::transaction(function () use ($applicationId, $remarks, $actedBy) {
            $app = DB::table('applications')->where('id', $applicationId)->lockForUpdate()->first();
            if (!$app) return false; // Fix BUG-1

            DB::table('applications')
                ->where('id', $applicationId)
                ->update([
                    'status' => 'declined',
                    'is_active' => false,
                    'updated_at' => now(),
                ]);

            DB::table('application_rejections')->insert([
                'application_id' => $applicationId,
                'rejection_type' => 'final',
                'rejection_reason' => $remarks,
                'rejected_by' => $actedBy,
                'rejected_at' => now(),
                'created_at' => now(),
                'updated_at' => now()
            ]);


            $this->checkAndBlockUser($app->user_id);


            DB::table('application_workflow_logs')->insert([
                'application_id' => $applicationId,
                'workflow_step_id' => $app->current_step_id,
                'action' => 'Final Rejection',
                'remarks' => $remarks,
                'action_by' => $actedBy,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Also record in application_approvals so tracker sees it as a completed step
            DB::table('application_approvals')->updateOrInsert(
                ['application_id' => $applicationId, 'workflow_step_id' => $app->current_step_id],
                [
                    'approved_by' => $actedBy,
                    'status' => 'declined',
                    'remarks' => $remarks,
                    'approved_at' => now(),
                    'updated_at' => now()
                ]
            );

            // Dispatch Email Notification
            $user = DB::table('users')->where('user_id', $app->user_id)->first();
            $profile = DB::table('user_profiles')->where('user_id', $app->user_id)->first();

            if ($user && $user->email) {
                $name = $profile ? ($profile->first_name . ' ' . $profile->last_name) : 'Applicant';

                try {
                    Mail::to($user->email)->queue(new ApplicationDeclinedMail(
                        $name,
                        $app->application_id,
                        $remarks
                    ));
                } catch (\Exception $e) {
                    Log::error('Failed to send rejection email: ' . $e->getMessage());
                }
            }

            return true;
        });
    }

    /**
     * Approves the current step and progresses the application to the next step in the workflow.
     * 
     * Business Logic:
     * 1. Logs the approval in `application_approvals` and pivot tables (`approval_services`).
     * 2. Finds the next step in the assigned workflow schema.
     * 3. If there is no next step, it marks the application as 'approved'.
     * 4. If there is a next step, it assigns the application to the next reviewer pool/user and emails them.
     * 
     * Performance:
     * Runs inside a DB transaction to ensure workflow state and logs are fully synchronized.
     * 
     * @param int $applicationId Database ID of the application
     * @param string $actedBy User ID of the approver
     * @param string|null $nextAssigneeId Specific user to assign the next step to (optional)
     * @param string|null $comments Approval remarks
     * @param array|null $recommendedServices Array of service_ids and subservice_ids recommended by reviewer
     * @param string|null $duration Approved duration
     * @return array Target status and routing message
     */
    public function moveToNextStep(int $applicationId, string $actedBy, string $actionSlug, ?string $nextAssigneeId = null, ?string $comments = null, $recommendedServices = null, ?string $duration = null): array|bool
    {
        return DB::transaction(function () use ($applicationId, $actedBy, $actionSlug, $nextAssigneeId, $comments, $recommendedServices, $duration) {
            $app = DB::table('applications as app')
                ->leftJoin('app_activation_details as aad', 'app.id', '=', 'aad.application_id')
                ->where('app.id', $applicationId)
                ->select('app.*', 'aad.assigned_system_id', 'aad.assigned_subsystem_id')
                ->lockForUpdate()
                ->first();
            if (!$app)
                return false;

            $currentStep = DB::table('workflow_steps as ws')
                ->join('roles as r', 'ws.role_id', '=', 'r.id')
                ->join('workflow_statuses as st', 'ws.status_id', '=', 'st.id')
                ->where('ws.workflow_step_id', $app->current_step_id)
                ->select('ws.*', 'r.slug as role_slug', 'st.name as status_name', DB::raw('NULL as step_action'))
                ->first();
                
            if (!$currentStep) return false;

            $actionId = DB::table('workflow_actions')->where('slug', $actionSlug)->value('id');
            if (!$actionId) {
                throw new \Exception("Invalid action: {$actionSlug}");
            }

            // Find next step using workflow_transitions
            $transition = DB::table('workflow_transitions')
                ->where('workflow_step_id', $app->current_step_id)
                ->where('action_id', $actionId)
                ->first();

            if (!$transition) {
                throw new \Exception("No transition defined for this step with action: {$actionSlug}");
            }

            $nextStep = null;
            if ($transition->next_step_id) {
                $nextStep = DB::table('workflow_steps as ws')
                    ->join('roles as r', 'ws.role_id', '=', 'r.id')
                    ->join('workflow_statuses as st', 'ws.status_id', '=', 'st.id')
                    ->where('ws.workflow_step_id', $transition->next_step_id)
                    ->where('ws.is_active', true)
                    ->select('ws.*', 'r.slug as role_slug', 'st.name as status_name', DB::raw('NULL as step_action'))
                    ->first();
            }

            // 1. Log the current approval action
            DB::table('application_approvals')->updateOrInsert(
                ['application_id' => $applicationId, 'workflow_step_id' => $app->current_step_id],
                [
                    'status' => 'approved',
                    'approved_by' => $actedBy,
                    'remarks' => $comments,
                    'duration' => $duration,
                    'updated_at' => now(),
                    'approved_at' => now(),
                ]
            );

            $approvalId = DB::table('application_approvals')
                ->where('application_id', $applicationId)
                ->where('workflow_step_id', $app->current_step_id)
                ->value('id');

            // Insert recommended services into 3NF pivot tables
            if (is_array($recommendedServices)) {
                if (!empty($recommendedServices['service_ids'])) {
                    $svcInserts = array_map(fn($sid) => ['approval_id' => $approvalId, 'service_id' => $sid, 'created_at' => now(), 'updated_at' => now()], $recommendedServices['service_ids']);
                    DB::table('approval_services')->insert($svcInserts);
                }
                if (!empty($recommendedServices['subservice_ids'])) {
                    $subSvcInserts = array_map(fn($sid) => ['approval_id' => $approvalId, 'subservice_id' => $sid, 'created_at' => now(), 'updated_at' => now()], $recommendedServices['subservice_ids']);
                    DB::table('approval_subservices')->insert($subSvcInserts);
                }
            }

            DB::table('application_workflow_logs')->insert([
                'application_id' => $applicationId,
                'workflow_step_id' => $app->current_step_id,
                'action' => 'Approved',
                'remarks' => $comments,
                'action_by' => $actedBy,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // 1.2 Update application-wide computing_services flag if services were recommended
            if ($recommendedServices) {
                $rs = is_string($recommendedServices) ? json_decode($recommendedServices, true) : $recommendedServices;
                if (!empty($rs['service_ids'])) {
                    $hasComputing = DB::table('services')
                        ->whereIn('id', $rs['service_ids'])
                        ->where('is_computing', true)
                        ->exists();
                    
                    if ($hasComputing) {
                        DB::table('app_activation_details')->where('application_id', $applicationId)->update(['computing_services' => true]);
                    }
                }
            }

            // 1.1 Mark identity as approved if the current step is an identity approval step
            if ($currentStep->step_action === 'approve_identity') {
                DB::table('application_id_proof_reviews')
                    ->where('application_id', $applicationId)
                    ->update([
                        'review_status' => 'approved',
                        'resolved_at' => now(),
                        'updated_at' => now()
                    ]);

                // Trigger identity approval mail
                $applicant = DB::table('users as u')
                    ->join('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                    ->where('u.user_id', $app->user_id)
                    ->select('u.email', DB::raw("CONCAT(up.first_name, ' ', up.last_name) as full_name"))
                    ->first();

                if ($applicant) {
                    try {
                        Mail::to($applicant->email)->queue(new ApplicationIdentityApprovedMail($applicant->full_name ?? 'Applicant', $app->application_id));
                    } catch (\Exception $e) {
                        Log::error("Failed to send identity approval mail: " . $e->getMessage());
                    }
                }
            }

            if (!$nextStep) {
                // NO MORE STEPS -> FINAL APPROVAL
                DB::table('applications')->where('id', $applicationId)->update([
                    'status' => 'approved',
                    'current_step_id' => null,
                    'current_assignee_id' => null,
                    'updated_at' => now()
                ]);

                // Apply requested affiliation if present (Modify Affiliation workflow)
                $snapshot = json_decode($app->profile_snapshot ?? '{}', true);
                if (isset($snapshot['requested_affiliation'])) {
                    $reqAffil = $snapshot['requested_affiliation'];
                    DB::table('user_affilation')->updateOrInsert(
                        ['user_id' => $app->user_id],
                        [
                            'institute_id' => $reqAffil['institute_id'] ?? null,
                            'other_institute' => $reqAffil['other_institute'] ?? null,
                            'category_id' => $reqAffil['category_id'] ?? null,
                            'id_card_path' => $reqAffil['id_card_path'] ?? null,
                            'is_active' => true,
                            'updated_at' => now()
                        ]
                    );
                }

                // Determine expiration based on duration
                $applicationDuration = DB::table('app_activation_details')
                    ->where('application_id', $applicationId)
                    ->value('duration');

                $expiresAt = null;
                $isRea = DB::table('applications')->where('id', $applicationId)->where('application_id', 'like', '%-REA%')->exists();

                if ($isRea) {
                    $expiresAt = DB::table('users')->where('user_id', $app->user_id)->value('expired_at');
                } elseif ($applicationDuration) {
                    try {
                        $expiresAt = now()->modify('+' . $applicationDuration);
                    } catch (\Exception $e) {
                        $expiresAt = now()->addMonths(6); // fallback
                    }
                }

                if (!$isRea && $expiresAt) {
                    DB::table('users')->where('user_id', $app->user_id)->update(['expired_at' => $expiresAt]);
                }

                // Copy approved services to user account
                $latestApprovalIdWithServices = DB::table('approval_services')
                    ->join('application_approvals', 'approval_services.approval_id', '=', 'application_approvals.id')
                    ->where('application_approvals.application_id', $applicationId)
                    ->orderBy('application_approvals.id', 'desc')
                    ->value('approval_services.approval_id');

                if ($latestApprovalIdWithServices) {
                    $sIds = DB::table('approval_services')->where('approval_id', $latestApprovalIdWithServices)->pluck('service_id');
                    foreach ($sIds as $sId) {
                        DB::table('user_active_services')->updateOrInsert(
                            ['user_id' => $app->user_id, 'service_id' => $sId],
                            ['is_active' => true, 'expires_at' => $expiresAt, 'updated_at' => now()]
                        );
                    }
                }

                $latestApprovalIdWithSubservices = DB::table('approval_subservices')
                    ->join('application_approvals', 'approval_subservices.approval_id', '=', 'application_approvals.id')
                    ->where('application_approvals.application_id', $applicationId)
                    ->orderBy('application_approvals.id', 'desc')
                    ->value('approval_subservices.approval_id');

                if ($latestApprovalIdWithSubservices) {
                    $subIds = DB::table('approval_subservices')->where('approval_id', $latestApprovalIdWithSubservices)->pluck('subservice_id');
                    foreach ($subIds as $subId) {
                        DB::table('user_active_subservices')->updateOrInsert(
                            ['user_id' => $app->user_id, 'subservice_id' => $subId],
                            ['is_active' => true, 'expires_at' => $expiresAt, 'updated_at' => now()]
                        );
                    }
                }


                // Notify Applicant of Final Approval
                $applicantUser = DB::table('users as u')
                    ->join('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                    ->where('u.user_id', $app->user_id)
                    ->select('u.email', DB::raw("CONCAT(up.first_name, ' ', up.last_name) as full_name"))
                    ->first();

                if ($applicantUser) {
                    try {
                        Mail::to($applicantUser->email)->queue(new ApplicationFinalMail(
                            $applicantUser->full_name ?? 'Applicant',
                            $app->application_id
                        ));
                    } catch (\Exception $e) {
                        Log::error("Failed to notify applicant of final approval: " . $e->getMessage());
                    }
                }

                return ['status' => 'final_approved'];
            }

            // 2. MOVE TO NEXT STEP
            DB::table('applications')->where('id', $applicationId)->update([
                'current_step_id' => $nextStep->workflow_step_id,
                'current_assignee_id' => $nextAssigneeId,
                'status' => 'under_review',
                'updated_at' => now()
            ]);

            // ── LI-Coordinator Routing Logic ──
            if (!$nextAssigneeId && $nextStep->role_slug === 'li_coordinator') {
                $targetInstituteId = null;

                if ($nextStep->step_action === 'approve_identity') {
                    // IDENTITY STEP: Fetch the institute of the APPLICANT
                    // First, check if there's a requested_affiliation (e.g. for Modify Affiliation workflow)
                    $snapshot = json_decode($app->profile_snapshot ?? '{}', true);
                    if (isset($snapshot['requested_affiliation']['institute_id'])) {
                        $targetInstituteId = $snapshot['requested_affiliation']['institute_id'];
                    } else {
                        $targetInstituteId = DB::table('user_affilation')
                            ->where('user_id', $app->user_id)
                            ->value('institute_id');
                    }
                } else {
                    // TECHNICAL/FINAL STEP: Fetch the institute associated with the assigned system
                    if ($app->assigned_subsystem_id) {
                        $targetInstituteId = DB::table('subsystems as sub')
                            ->join('systems as s', 'sub.system_id', '=', 's.id')
                            ->where('sub.id', $app->assigned_subsystem_id)
                            ->value('s.institute_id');
                    } elseif ($app->assigned_system_id) {
                        $targetInstituteId = DB::table('systems')
                            ->where('id', $app->assigned_system_id)
                            ->value('institute_id');
                    }
                }

                // Try to find LI-Coordinator with same institute as identified above
                $targetLi = null;
                if ($targetInstituteId) {
                    $targetLi = DB::table('users as u')
                        ->join('user_roles as ur', 'u.user_id', '=', 'ur.user_id')
                        ->join('roles as r', 'ur.role_id', '=', 'r.id')
                        ->leftJoin('user_affilation as ua', 'u.user_id', '=', 'ua.user_id')
                        ->where('r.slug', 'li_coordinator')
                        ->where('ua.institute_id', $targetInstituteId)
                        ->where('ur.is_active', true)
                        ->value('u.user_id');
                }

                if (!$targetLi) {
                    // Default to LI-Coordinator with is_default = true (Global fallback - IUCAA)
                    $targetLi = DB::table('users as u')
                        ->join('user_roles as ur', 'u.user_id', '=', 'ur.user_id')
                        ->join('roles as r', 'ur.role_id', '=', 'r.id')
                        ->where('r.slug', 'li_coordinator')
                        ->where('ur.is_default', true)
                        ->where('ur.is_active', true)
                        ->value('u.user_id');
                }

                if ($targetLi) {
                    $nextAssigneeId = $targetLi;
                    // Update application to ensure single assignment
                    DB::table('applications')->where('id', $applicationId)->update([
                        'current_assignee_id' => $nextAssigneeId
                    ]);
                }
            }

            // 3. RECORD ASSIGNMENT IF DYNAMIC
            if ($nextAssigneeId) {
                DB::table('workflow_step_assignments')->insert([
                    'application_id' => $applicationId,
                    'workflow_step_id' => $nextStep->workflow_step_id,
                    'assigned_user_id' => $nextAssigneeId,
                    'assigned_by' => $actedBy,
                    'assigned_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now()
                ]);

                // Notify Next Reviewer
                $nextUser = DB::table('users')->where('user_id', $nextAssigneeId)->first();
                if ($nextUser) {
                    $applicant = DB::table('users as u')
                        ->join('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                        ->where('u.user_id', $app->user_id)
                        ->select(DB::raw("CONCAT(up.first_name, ' ', up.last_name) as full_name"))
                        ->first();

                    try {
                        Mail::to($nextUser->email)->queue(new ApplicationApprovalMail(
                            $applicant->full_name ?? 'Applicant',
                            $app->application_id,
                            $nextStep->status_name
                        ));
                    } catch (\Exception $e) {
                        Log::error("Failed to notify next assignee: " . $e->getMessage());
                    }
                }
            } else {
                // NOTIFY ROLE-BASED AUTHORITIES (System Lead, Subsystem Lead, etc.)
                $roleSlug = $nextStep->role_slug;
                if ($roleSlug) {
                    $query = DB::table('users as u')
                        ->join('user_roles as ur', 'u.user_id', '=', 'ur.user_id')
                        ->join('roles as r', 'ur.role_id', '=', 'r.id')
                        ->where('r.slug', $roleSlug)
                        ->where('ur.is_active', true)
                        ->where('u.status', '!=', 'deactivated');
                    if ($roleSlug === 'subsystem_lead' && $app->assigned_subsystem_id) {
                        $query->join('entity_assignments as ea', function ($join) use ($app) {
                            $join->on('u.user_id', '=', 'ea.user_id')
                                 ->where('ea.entity_type', '=', 'subsystem')
                                 ->where('ea.entity_id', '=', $app->assigned_subsystem_id)
                                 ->where('ea.is_active', '=', true);
                        });
                    } elseif ($roleSlug === 'system_lead' && $app->assigned_system_id) {
                        $query->join('entity_assignments as ea', function ($join) use ($app) {
                            $join->on('u.user_id', '=', 'ea.user_id')
                                 ->where('ea.entity_type', '=', 'system')
                                 ->where('ea.entity_id', '=', $app->assigned_system_id)
                                 ->where('ea.is_active', '=', true);
                        });
                    }
                    
                    $nextUsers = $query->select('u.email')->distinct()->get();
                    
                    if ($nextUsers->isNotEmpty()) {
                        $applicant = DB::table('users as u')
                            ->join('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                            ->where('u.user_id', $app->user_id)
                            ->select(DB::raw("CONCAT(up.first_name, ' ', up.last_name) as full_name"))
                            ->first();
                            
                        foreach ($nextUsers as $nu) {
                            try {
                                Mail::to($nu->email)->queue(new ApplicationApprovalMail(
                                    $applicant->full_name ?? 'Applicant',
                                    $app->application_id,
                                    $nextStep->status_name
                                ));
                            } catch (\Exception $e) {
                                Log::error("Failed to notify role assignee: " . $e->getMessage());
                            }
                        }
                    }
                }
            }

            // Notify Applicant (User) about progress
            $applicantUser = DB::table('users as u')
                ->join('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                ->where('u.user_id', $app->user_id)
                ->select('u.email', DB::raw("CONCAT(up.first_name, ' ', up.last_name) as full_name"))
                ->first();

            if ($applicantUser) {
                try {
                    Mail::to($applicantUser->email)->queue(new ApplicationProgressMail(
                        $applicantUser->full_name ?? 'Applicant',
                        $app->application_id,
                        $currentStep->status_name ?? 'Previous Stage',
                        $nextStep->status_name ?? 'Next Stage'
                    ));
                } catch (\Exception $e) {
                    Log::error("Failed to notify applicant of progress: " . $e->getMessage());
                }
            }

            return ['status' => 'transitioned', 'next_step' => $nextStep->step_code ?? $nextStep->status_name];
        });
    }

    /**
     * Checks if a user has hit their maximum retry limit and blocks them if so.
     * 
     * Business Logic:
     * - A user is allowed 3 application rejections.
     * - If `retry_count >= 3`, the user's account is suspended (`is_blocked = true`).
     * 
     * @param string $userId The user's ID string
     * @return void
     */
    public function checkAndBlockUser(string $userId)
    {
        // Legacy column 'retry_count' has been purged.
        // Rejections are tracked via block_history or logs in the future.
    }

    /**
     * Determines if a user is eligible to submit a new application.
     * 
     * Rules:
     * - Blocked users cannot reapply.
     * - Users with an active/pending application cannot reapply (one active app limit).
     * 
     * @param string $userId The user's ID string
     * @return array Associative array with boolean 'can_reapply' and string 'reason'
     */
    public function canUserReapply(string $userId)
    {
        $user = DB::table('users')->where('user_id', $userId)->first();

        if ($user->status === 'deactivated') {
            $lastBlock = DB::table('block_history')
                ->where('user_id', $userId)
                ->orderBy('created_at', 'desc')
                ->first();
            $reason = $lastBlock->reason ?? 'Administrative action.';

            return [
                'can_reapply' => false,
                'reason' => 'Account is blocked: ' . $reason
            ];
        }

        $activeApp = DB::table('applications')
            ->where('user_id', $userId)
            ->whereIn('status', ['submitted', 'under_review', 'id_proof_pending', 'approved'])
            ->exists();

        if ($activeApp) {
            return [
                'can_reapply' => false,
                'reason' => 'You already have an active application in progress.'
            ];
        }

        return ['can_reapply' => true];
    }
}
