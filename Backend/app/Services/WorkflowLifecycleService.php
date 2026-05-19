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
     * Send application back for valid ID card upload.
     */
    public function sendBackForIdCard(int $applicationId, string $remarks, string $actedBy)
    {
        return DB::transaction(function () use ($applicationId, $remarks, $actedBy) {
            $app = DB::table('applications')->where('id', $applicationId)->first();
            if (!$app) return false;

            // If ID is already approved, it cannot be sent back for correction
            if ($app->id_card_approved_by) {
                throw new \Exception("This application's identity has already been verified and cannot be sent back for correction.");
            }

            // 1. Update Application Status and Metadata
            DB::table('applications')
                ->where('id', $applicationId)
                ->update([
                    'status' => 'id_card_reupload_required',
                    'paused_workflow_step' => $app->current_step_id,
                    'id_card_review_requested_by' => $actedBy,
                    'id_card_review_requested_at' => now(),
                    'id_card_reupload_remarks' => $remarks,
                    'updated_at' => now(),
                ]);

            // 2. Log the action
            DB::table('application_logs')->insert([
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
     * Handle final rejection.
     */
    public function finalReject(int $applicationId, string $remarks, string $actedBy)
    {
        return DB::transaction(function () use ($applicationId, $remarks, $actedBy) {
            $app = DB::table('applications')->where('id', $applicationId)->first();

            DB::table('applications')
                ->where('id', $applicationId)
                ->update([
                    'status' => 'declined',
                    'rejection_type' => 'final',
                    'rejection_reason' => $remarks,
                    'declined_reason' => $remarks,
                    'rejected_by' => $actedBy,
                    'rejected_at' => now(),
                    'is_active' => false,
                    'updated_at' => now(),
                ]);

            // Increment retry count for the user
            DB::table('users')
                ->where('user_id', $app->user_id)
                ->increment('retry_count');

            $this->checkAndBlockUser($app->user_id);

            DB::table('application_logs')->insert([
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
     * Advance application to the next workflow step.
     */
    public function moveToNextStep(int $applicationId, string $actedBy, ?string $nextAssigneeId = null, ?string $comments = null, ?string $recommendedServices = null, ?string $duration = null)
    {
        return DB::transaction(function () use ($applicationId, $actedBy, $nextAssigneeId, $comments, $recommendedServices, $duration) {
            $app = DB::table('applications')->where('id', $applicationId)->first();
            if (!$app)
                return false;

            $currentStep = DB::table('workflow_steps as ws')
                ->join('roles as r', 'ws.role_id', '=', 'r.id')
                ->where('ws.workflow_step_id', $app->current_step_id)
                ->select('ws.*', 'r.slug as role_slug')
                ->first();

            // Find next active step
            $nextStep = DB::table('workflow_steps as ws')
                ->join('roles as r', 'ws.role_id', '=', 'r.id')
                ->where('ws.workflow_id', $app->workflow_id)
                ->where('ws.step_no', '>', ($currentStep->step_no ?? 0))
                ->where('ws.is_active', true)
                ->orderBy('ws.step_no', 'asc')
                ->select('ws.*', 'r.slug as role_slug')
                ->first();

            // 1. Log the current approval action
            DB::table('application_approvals')->updateOrInsert(
                ['application_id' => $applicationId, 'workflow_step_id' => $app->current_step_id],
                [
                    'status' => 'approved',
                    'approved_by' => $actedBy,
                    'remarks' => $comments,
                    'recommended_services' => $recommendedServices,
                    'duration' => $duration,
                    'updated_at' => now(),
                    'approved_at' => now(),
                ]
            );

            DB::table('application_logs')->insert([
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
                $rs = json_decode($recommendedServices, true);
                if (!empty($rs['service_ids'])) {
                    $hasComputing = DB::table('services')
                        ->whereIn('id', $rs['service_ids'])
                        ->where('is_computing', true)
                        ->exists();
                    
                    if ($hasComputing) {
                        DB::table('applications')->where('id', $applicationId)->update(['computing_services' => true]);
                    }
                }
            }

            // 1.1 Mark identity as approved if the current actor is LI-Coordinator and approving
            if ($currentStep->role_slug === 'li_coordinator') {
                DB::table('applications')->where('id', $applicationId)->update([
                    'id_card_approved_by' => $actedBy,
                    'id_card_approved_at' => now(),
                ]);

                // Trigger identity approval mail
                $applicant = DB::table('users as u')
                    ->join('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                    ->where('u.user_id', $app->user_id)
                    ->select('u.email', DB::raw("CONCAT(up.first_name, ' ', up.last_name) as full_name"))
                    ->first();

                if ($applicant) {
                    try {
                        Mail::to($applicant->email)->send(new ApplicationIdentityApprovedMail($applicant->full_name ?? 'Applicant', $app->application_id));
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
                    'approved_at' => now(),
                    'approved_by' => $actedBy,
                    'updated_at' => now()
                ]);

                // Notify Applicant of Final Approval
                $applicantUser = DB::table('users as u')
                    ->join('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                    ->where('u.user_id', $app->user_id)
                    ->select('u.email', DB::raw("CONCAT(up.first_name, ' ', up.last_name) as full_name"))
                    ->first();

                if ($applicantUser) {
                    try {
                        Mail::to($applicantUser->email)->send(new ApplicationFinalMail(
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
                    $targetInstituteId = DB::table('user_affilation')
                        ->where('user_id', $app->user_id)
                        ->value('institute_id');
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
                        Mail::to($nextUser->email)->send(new ApplicationApprovalMail(
                            $applicant->full_name ?? 'Applicant',
                            $app->application_id,
                            $nextStep->status_name
                        ));
                    } catch (\Exception $e) {
                        Log::error("Failed to notify next assignee: " . $e->getMessage());
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
                    Mail::to($applicantUser->email)->send(new ApplicationProgressMail(
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
     * Check retry limits and block user if necessary.
     */
    public function checkAndBlockUser(string $userId)
    {
        $user = DB::table('users')->where('user_id', $userId)->first();
        $maxRetries = 3 + ($user->admin_buffer_count ?? 0);

        if ($user->retry_count >= $maxRetries) {
            DB::table('users')
                ->where('user_id', $userId)
                ->update([
                    'is_blocked' => true,
                    'blocked_reason' => 'Maximum retry attempts reached (' . $user->retry_count . ').',
                    'blocked_at' => now(),
                ]);
        }
    }

    /**
     * Prepare for a new application (reapply).
     */
    public function canUserReapply(string $userId)
    {
        $user = DB::table('users')->where('user_id', $userId)->first();

        if ($user->is_blocked) {
            return [
                'can_reapply' => false,
                'reason' => 'Account is blocked: ' . ($user->blocked_reason ?? 'Retry limit exceeded.')
            ];
        }

        $activeApp = DB::table('applications')
            ->where('user_id', $userId)
            ->whereIn('status', ['submitted', 'under_review', 'correction_required', 'resubmitted', 'pending', 'approved_processing'])
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
