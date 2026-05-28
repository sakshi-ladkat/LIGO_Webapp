<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use App\Models\Institute;
use App\Models\Role;
use App\Models\Title;
use App\Models\Country;
use Illuminate\Support\Facades\Log;
use App\Models\Continent;
use Illuminate\Support\Facades\Mail;
use App\Mail\ApplicationSubmissionMail;
use App\Mail\ApplicationConfirmationMail;
use App\Services\WorkflowLifecycleService;
use App\Services\DuplicateApplicantService;

class RegistrationController extends Controller
{
    /**
     * Submit a new registration application or resubmit a correction.
     * 
     * Business Logic:
     * - Validates user session and eligibility to apply/reapply.
     * - Upserts user demographic, academic, and contact profiles.
     * - Maps the user to the correct workflow schema based on designation/request type.
     * - Creates or updates the `applications` record.
     * - Pre-generates pending approval records for transparency.
     * - Dispatches email notifications to the applicant and the first reviewer.
     * 
     * Performance:
     * - Enclosed in a DB transaction to ensure profile syncs perfectly with application creation.
     * 
     * @param Request $request
     * @param WorkflowLifecycleService $lifecycleService
     * @param DuplicateApplicantService $duplicateService
     * @return \Illuminate\Http\JsonResponse
     */
    public function submit(Request $request, WorkflowLifecycleService $lifecycleService, DuplicateApplicantService $duplicateService)
    {
        Log::warning('HIT REGISTRATION');
        // Auth user ID is securely provided by our custom JwtMiddleware
        $userId = $request->auth_user_id;

        if (!$userId) {
            return response()->json(['error' => 'Unauthorized. No session found.'], 401);
        }

        // Verify that the user still exists in the database (handles post-migration stale sessions)
        $userExists = User::where('user_id', $userId)->exists();
        if (!$userExists) {
            return response()->json(['error' => 'Your session is stale (user no longer exists in database). Please log out and back in.'], 401);
        }

        try {
            // Check retry limit and active applications
            $check = $lifecycleService->canUserReapply($userId);

            // Check if this is a resubmission for an existing "correction required" application
            $existingApp = DB::table('applications')
                ->where('user_id', $userId)
                ->where('status', 'correction_required')
                ->first();

            if (!$check['can_reapply'] && !$existingApp) {
                return response()->json(['error' => $check['reason']], 422);
            }

            Log::info('Registration Submission Started', [
                'user_id' => $userId,
            ]);

            $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
                'graduationYear' => 'required|digits:4|integer|min:' . (date('Y') - 70) . '|max:2100',
                'graduationMonth' => 'required|integer|min:1|max:12',
                'department' => 'required|string|max:255',
            ]);

            if ($validator->fails()) {
                return response()->json(['error' => 'Please provide a valid 4-digit graduation year (e.g. 2024) and month.'], 422);
            }

            DB::beginTransaction();

            $instituteId = $request->input('institute');
            if ($instituteId === 'other') {
                $otherName = $request->input('otherInstitute');
                if (!$otherName) {
                    DB::rollBack();
                    return response()->json(['error' => 'Please provide the custom institute name.'], 422);
                }

                $normalized = trim(preg_replace('/\s+/', ' ', strtolower($otherName)));
                $existingInst = Institute::where('normalized_name', $normalized)->first();

                if ($existingInst) {
                    $instituteId = $existingInst->id;
                } else {
                    // Active immediately so it appears in dropdown; admin manages name via Modify Institutes.
                    $newInst = Institute::create([
                        'name'              => trim($otherName),
                        'normalized_name'   => $normalized,
                        'is_user_suggested' => true,
                        'created_by'        => $userId,
                        'is_active'         => true,
                    ]);
                    $instituteId = $newInst->id;
                }
            }

            // Sync User Affiliation logic
            if ($instituteId) {
                DB::table('users')->where('user_id', $userId)->update([
                    'institute_id' => $instituteId
                ]);

                $affiliationData = [
                    'institute_id' => $instituteId,
                    'other_institute' => $request->input('otherInstitute'),
                    'category_id' => $request->input('designation'),
                    'department' => $request->input('department'),
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now()
                ];

                $isStudent = false;
                $categoryId = $request->input('designation');
                if ($categoryId) {
                    $cat = DB::table('categories')->where('id', $categoryId)->first();
                    if ($cat && ($cat->slug === 'student' || $cat->parent_id == 1)) {
                        $isStudent = true;
                    }
                }

                if ($request->hasFile('id_card')) {
                    $file = $request->file('id_card');
                    if (!$file->isValid()) {
                        DB::rollBack();
                        return response()->json(['error' => 'Invalid file upload: ' . $file->getErrorMessage()], 422);
                    }
                    $path = $file->store('id_cards');
                    $affiliationData['id_card_path'] = $path;
                } elseif ($isStudent) {
                    DB::rollBack();
                    return response()->json(['error' => 'Identity Card is required for students.'], 422);
                }

                DB::table('user_affilation')->updateOrInsert(
                    ['user_id' => $userId],
                    $affiliationData
                );
            }

            // 1. Assign default 'User' role in active state
            $baseRole = Role::firstOrCreate(['slug' => 'user'], ['name' => 'User', 'is_active' => true]);
            DB::table('user_roles')->updateOrInsert(
                ['user_id' => $userId, 'role_id' => $baseRole->id],
                ['is_active' => true, 'created_at' => now(), 'updated_at' => now()]
            );

            // 2. Automate user_request entry for Admin approval cue
            $regAction = DB::table('requests')->where('name', 'Account Activation')->first();
            if (!$regAction) {
                $requestId = DB::table('requests')->insertGetId([
                    'name' => 'Account Activation',
                    'type' => 'service_permission',
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            } else {
                /** @var object $regAction */
                $requestId = $regAction->id;
            }

            DB::table('user_requests')->updateOrInsert(
                ['user_id' => $userId, 'request_id' => $requestId],
                ['is_active' => true, 'created_at' => now(), 'updated_at' => now()]
            );

            // 3. Algorithmically locate Workflow schema mapped to this Request + Category
            $targetWorkflow = DB::table('workflow_category_mappings as wcm')
                ->join('workflows as wf', 'wcm.workflow_id', '=', 'wf.workflow_id')
                ->where('wcm.request_id', $requestId)
                ->where('wcm.category_id', $request->input('designation'))
                ->where('wf.is_latest', true)
                ->where('wf.is_active', true)
                ->select('wf.workflow_id')
                ->first();

            $workflowId = $targetWorkflow ? $targetWorkflow->workflow_id : null;

            // 4. Mount Application dynamically into the routing pipeline
            if ($workflowId) {
                $firstStep = DB::table('workflow_steps')
                    ->where('workflow_id', $workflowId)
                    ->orderBy('step_no', 'asc')
                    ->first();

                $isCorrectionResubmission = false;
                $allowedCorrectionFields = [];

                if ($existingApp) {
                    // RESUBMIT logic (Update existing record)
                    $isCorrectionResubmission = true;
                    $applicationId = $existingApp->id;
                    $allowedCorrectionFields = $existingApp->correction_fields ? json_decode($existingApp->correction_fields, true) : [];

                    DB::table('applications')->where('id', $applicationId)->update([
                        'status' => 'resubmitted',
                        'correction_required' => false,
                        'updated_at' => now()
                    ]);

                    // Log resubmission
                    DB::table('application_logs')->insert([
                        'application_id' => $applicationId,
                        'action' => 'Resubmitted',
                        'remarks' => 'Applicant addressed correction requirements.',
                        'action_by' => $userId,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]);
                } else {
                    // NEW APPLICATION (REAPPLY) logic
                    $lastRejectedApp = DB::table('applications')
                        ->where('user_id', $userId)
                        ->whereIn('status', ['rejected', 'declined', 'final_rejected', 'final_rejection'])
                        ->orderByDesc('created_at')
                        ->first();

                    if ($lastRejectedApp) {
                        $oldSnapshot = $this->createProfileSnapshot($userId);
                        DB::table('applications')
                            ->where('id', $lastRejectedApp->id)
                            ->update([
                                'status' => 'reapplied',
                                'profile_snapshot' => json_encode($oldSnapshot),
                                'updated_at' => now()
                            ]);
                    }

                    $appId = uniqid('APP-');
                    $applicationId = DB::table('applications')->insertGetId([
                        'user_id' => $userId,
                        'request_id' => $requestId,
                        'application_id' => $appId,
                        'parent_application_id' => $lastRejectedApp ? $lastRejectedApp->id : null,
                        'reapplied_from' => $lastRejectedApp ? $lastRejectedApp->application_id : null,
                        'workflow_id' => $workflowId,
                        'current_step_id' => $firstStep ? $firstStep->workflow_step_id : null,
                        'status' => 'submitted',
                        'current_stage' => 'submitted',
                        'id_card_path' => $affiliationData['id_card_path'] ?? null,
                        'is_active' => true,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]);
                }

                // Fetch record for subsequent steps
                $appRecord = DB::table('applications')->where('id', $applicationId)->first();

                if ($appRecord) {
                    // Pre-create/Reset all approval entries for transparency
                    $allSteps = DB::table('workflow_steps')
                        ->where('workflow_id', $workflowId)
                        ->orderBy('step_no', 'asc')
                        ->get();

                    foreach ($allSteps as $ws) {
                        DB::table('application_approvals')->updateOrInsert(
                            ['application_id' => $appRecord->id, 'workflow_step_id' => $ws->workflow_step_id],
                            [
                                'status' => 'pending',
                                'updated_at' => now()
                            ]
                        );
                    }
                }
            }

            // 3. Complete Profile Demographics Sync
            $profileUpdateAllowed = true;
            if ($isCorrectionResubmission) {
                // If in correction mode, only allow profile update if "Personal Details" was requested (example logic)
                // However, based on user requirements, let's stick to the mapping.
                $profileUpdateAllowed = false; // Default lock for profile in correction
            }

            if ($profileUpdateAllowed || !$isCorrectionResubmission) {
                $titleName = Title::find($request->input('title'))?->name ?? $request->input('title', 'Unknown');
                $firstName = $request->input('firstName', 'Unknown');
                $middleName = $request->input('middleName');
                $lastName = $request->input('lastName', 'Unknown');

                $normalizedName = $duplicateService->normalizeName($firstName, $middleName, $lastName);
                $soundex = $duplicateService->calculateSoundex($normalizedName);

                DB::table('user_profiles')->updateOrInsert(
                    ['user_id' => $userId],
                    [
                        'title' => $titleName,
                        'first_name' => $firstName,
                        'middle_name' => $middleName,
                        'last_name' => $lastName,
                        'normalized_full_name' => $normalizedName,
                        'soundex_name' => $soundex,
                        'date_of_birth' => $request->input('dob', now()->toDateString()),
                        'gender' => strtolower($request->input('gender', 'prefer-not-to-say')),
                        'updated_at' => now()
                    ]
                );
            }

            // 4. Academic Sync
            $academicAllowed = true;
            if ($isCorrectionResubmission) {
                $academicAllowed = in_array('Incomplete Educational Details', $allowedCorrectionFields);
            }

            if ($academicAllowed) {
                $gradYear = $request->input('graduationYear') ?: date('Y');
                $gradMonth = $request->input('graduationMonth') ?: date('m');
                $now = now();
                $isQualActive = ($gradYear > $now->year) || ($gradYear == $now->year && $gradMonth >= $now->month);

                DB::table('user_qualification')->updateOrInsert(
                    ['user_id' => $userId],
                    [
                        'highest_qualification' => $request->input('highestDegree', 'None'),
                        'field_of_study' => $request->input('fieldOfStudy', 'None'),
                        'university' => $request->input('institutionAwarded', 'None'),
                        'graduation_year' => $gradYear,
                        'graduation_month' => $gradMonth,
                        'is_active' => $isQualActive,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]
                );
            }

            // 5. Contact Logistics Sync
            $contactAllowed = !$isCorrectionResubmission;
            if ($contactAllowed) {
                DB::table('user_contacts')->updateOrInsert(
                    ['user_id' => $userId],
                    [
                        'continent_id' => $request->input('continent'),
                        'country_id' => $request->input('country'),
                        'address_line_1' => $request->input('address1', 'Unknown'),
                        'address_line_2' => $request->input('address2'),
                        'address_line_3' => $request->input('address3'),
                        'city' => $request->input('city', 'Unknown'),
                        'state' => $request->input('state', 'Unknown'),
                        'postal_code' => $request->input('zipcode', 'Unknown'),
                        'country_code' => $request->input('phoneCode', ''),
                        'city_code' => $request->input('cityCode', ''),
                        'phone_number' => $request->input('phoneNumber', ''),
                        'fax_number' => $request->input('faxNumber', ''),
                        'created_at' => now(),
                        'updated_at' => now()
                    ]
                );
            }

            // 6. Institute / ID Card Sync
            $affiliationAllowed = true;
            if ($isCorrectionResubmission) {
                $affiliationAllowed = in_array('Invalid Institute Category', $allowedCorrectionFields) || in_array('Missing Identity Proof', $allowedCorrectionFields);
            }

            if ($affiliationAllowed) {
                $oldAffiliation = DB::table('user_affilation')->where('user_id', $userId)->first();
                $newIdCardPath = $oldAffiliation->id_card_path ?? null;

                if ($request->hasFile('id_card')) {
                    $file = $request->file('id_card');
                    $newIdCardPath = $file->store('id_cards');

                    // DOCUMENT VERSIONING
                    if ($isCorrectionResubmission) {
                        DB::table('document_versions')->insert([
                            'application_id' => $applicationId,
                            'field_name' => 'id_card',
                            'old_file_path' => $oldAffiliation->id_card_path ?? null,
                            'new_file_path' => $newIdCardPath,
                            'uploaded_by' => $userId,
                            'uploaded_at' => now(),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                }

                DB::table('user_affilation')->updateOrInsert(
                    ['user_id' => $userId],
                    [
                        'institute_id' => $instituteId,
                        'other_institute' => $request->input('otherInstitute'),
                        'category_id' => $request->input('designation'),
                        'department' => $request->input('department'),
                        'id_card_path' => $newIdCardPath,
                        'updated_at' => now()
                    ]
                );

                // Update application record path as well
                DB::table('applications')->where('id', $applicationId)->update(['id_card_path' => $newIdCardPath]);
            }

            // 6. Supervisor Pipeline Trigger
            $supervisorId = $request->input('supervisorSelect');
            if ($supervisorId) {
                DB::table('user_supervisors')->updateOrInsert(
                    ['user_id' => $userId],
                    [
                        'supervisor_id' => $supervisorId,
                        'is_active' => true,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]
                );
            }

            $user = User::where('user_id', $userId)->first();

            if ($user && $user->status === 'onboarding') {
                $user->update(['status' => 'pending-approval']);
            }

            // Create and update the snapshot for the current application now that all updates are applied
            if (isset($applicationId)) {
                $newSnapshot = $this->createProfileSnapshot($userId);
                DB::table('applications')
                    ->where('id', $applicationId)
                    ->update([
                        'profile_snapshot' => json_encode($newSnapshot)
                    ]);
            }

            DB::commit();

            // 7. Trigger Automated Notifications
            try {
                if (isset($appRecord) && $appRecord) {
                    $applicantProfile = DB::table('user_profiles')->where('user_id', $userId)->first();
                    $applicantName = $applicantProfile ? ($applicantProfile->first_name . ' ' . $applicantProfile->last_name) : 'Applicant';
                    $wfName = DB::table('workflows')->where('workflow_id', $workflowId)->value('workflow_name') ?? 'Default Workflow';

                    // Notify the supervisor (first reviewer)
                    if ($supervisorId) {
                        $supervisorUser = User::where('user_id', $supervisorId)->first();
                        if ($supervisorUser && $supervisorUser->email) {
                            Mail::to($supervisorUser->email)->send(new ApplicationSubmissionMail(
                                $applicantName,
                                $appRecord->application_id,
                                $wfName
                            ));
                        }
                    } else {
                        // Fallback: Notify anyone in the role assigned to the first step
                        $firstStep = DB::table('workflow_steps')
                            ->where('workflow_id', $workflowId)
                            ->where('step_no', 1)
                            ->first();

                        if ($firstStep) {
                            $approverEmails = [];
                            $role = DB::table('roles')->where('id', $firstStep->role_id)->first();

                            if ($role && $role->slug === 'li_coordinator') {
                                // Apply Institute-based routing for LI-Coordinator
                                $applicantInstituteId = DB::table('user_affilation')
                                    ->where('user_id', $userId)
                                    ->value('institute_id');

                                $targetLi = null;
                                if ($applicantInstituteId) {
                                    $targetLi = DB::table('users as u')
                                        ->join('user_roles as ur', 'u.user_id', '=', 'ur.user_id')
                                        ->leftJoin('user_affilation as ua', 'u.user_id', '=', 'ua.user_id')
                                        ->where('ur.role_id', $firstStep->role_id)
                                        ->where('ua.institute_id', $applicantInstituteId)
                                        ->where('ur.is_active', true)
                                        ->select('u.email', 'u.user_id')
                                        ->first();
                                }

                                if (!$targetLi) {
                                    // Fallback to default coordinator
                                    $targetLi = DB::table('users as u')
                                        ->join('user_roles as ur', 'u.user_id', '=', 'ur.user_id')
                                        ->where('ur.role_id', $firstStep->role_id)
                                        ->where('ur.is_default', true)
                                        ->where('ur.is_active', true)
                                        ->select('u.email', 'u.user_id')
                                        ->first();
                                }

                                if ($targetLi && $targetLi->email) {
                                    $approverEmails[] = $targetLi->email;
                                    // Also update current_assignee_id so it's assigned from the start
                                    DB::table('applications')->where('id', $appRecord->id)->update([
                                        'current_assignee_id' => $targetLi->user_id
                                    ]);
                                }
                            }

                            // If not LI-Coordinator or no specific LI found, notify the whole role (original logic)
                            if (empty($approverEmails)) {
                                $approverEmails = DB::table('users')
                                    ->join('user_roles', 'users.user_id', '=', 'user_roles.user_id')
                                    ->where('user_roles.role_id', $firstStep->role_id)
                                    ->where('user_roles.is_active', true)
                                    ->pluck('email')
                                    ->toArray();
                            }

                            foreach (array_filter($approverEmails) as $email) {
                                Mail::to($email)->send(new ApplicationSubmissionMail(
                                    $applicantName,
                                    $appRecord->application_id,
                                    $wfName
                                ));
                            }
                        }
                    }

                    // Notify the applicant — submission confirmation
                    $applicantUser = User::where('user_id', $userId)->first();
                    if ($applicantUser && $applicantUser->email) {
                        Mail::to($applicantUser->email)->send(new ApplicationConfirmationMail(
                            $applicantName,
                            $appRecord->application_id,
                            $wfName
                        ));
                    }
                }
            } catch (\Exception $mailEx) {
                Log::error('Registration Email Error: ' . $mailEx->getMessage());
                // Non-blocking for the user
            }

            return response()->json([
                'message' => 'Registration completed successfully.',
                'user' => $user
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error('Registration Error: ' . $e->getMessage(), [
                'user_id' => $userId,
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['error' => 'Registration failed due to a system error. Please try logging out and in again to refresh your session.'], 500);
        }
    }

    /**
     * Dedicated workflow endpoint to re-upload an ID card.
     */
    public function reuploadIdCard(Request $request, int $id)
    {
        $userId = $request->auth_user_id;

        if (!$userId) {
            return response()->json(['error' => 'Unauthorized.'], 401);
        }

        $request->validate([
            'id_card' => 'required|file|mimes:pdf,jpg,jpeg,png|max:5120',
        ]);

        try {
            DB::beginTransaction();
            $app = DB::table('applications')->where('id', $id)->where('user_id', $userId)->first();
            
            if (!$app) {
                return response()->json(['error' => 'Application not found.'], 404);
            }
            
            if ($app->status !== 'id_card_reupload_required') {
                return response()->json(['error' => 'This application is not currently pending an ID card re-upload.'], 422);
            }

            if (!$app->paused_workflow_step) {
                return response()->json(['error' => 'Workflow pause state is missing.'], 500);
            }

            $file = $request->file('id_card');
            $oldAff = DB::table('user_affilation')->where('user_id', $userId)->first();
            $path = $file->store('id_cards');

            // 1. Version control the old file
            DB::table('document_versions')->insert([
                'application_id' => $app->id,
                'field_name' => 'id_card',
                'old_file_path' => $oldAff->id_card_path ?? $app->id_card_path ?? null,
                'new_file_path' => $path,
                'uploaded_by' => $userId,
                'uploaded_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // 2. Update user affiliation
            DB::table('user_affilation')->where('user_id', $userId)->update(['id_card_path' => $path, 'updated_at' => now()]);
            
            // 3. Resume the application
            DB::table('applications')->where('id', $app->id)->update([
                'status' => 'pending_review', 
                'id_card_path' => $path, 
                'current_step_id' => $app->paused_workflow_step, // Resume from the exact paused step
                'paused_workflow_step' => null, // Clear the pause state
                'updated_at' => now()
            ]);
            
            // 4. Log the action
            DB::table('application_logs')->insert([
                'application_id' => $app->id, 
                'workflow_step_id' => $app->paused_workflow_step,
                'action' => 'ID Card Re-uploaded', 
                'remarks' => 'Applicant uploaded a new valid ID card. Workflow resumed.', 
                'action_by' => $userId, 
                'created_at' => now(), 
                'updated_at' => now()
            ]);

            DB::commit();
            return response()->json(['message' => 'Identity Proof re-uploaded successfully. Application workflow has been resumed.']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Captures a snapshot of the user profile, affiliation, contact, qualification, and supervisor details.
     */
    private function createProfileSnapshot(string $userId): array
    {
        $profile = DB::table('user_profiles')->where('user_id', $userId)->first();
        $qualification = DB::table('user_qualification')->where('user_id', $userId)->first();
        $contact = DB::table('user_contacts as uc')
            ->leftJoin('countries as c', 'uc.country_id', '=', 'c.id')
            ->leftJoin('continents as con', 'uc.continent_id', '=', 'con.id')
            ->where('uc.user_id', $userId)
            ->select('uc.*', 'c.name as country_name', 'con.name as continent_name')
            ->first();
        
        $affiliation = DB::table('user_affilation as ua')
            ->leftJoin('institutes as i', 'ua.institute_id', '=', 'i.id')
            ->leftJoin('categories as c', 'ua.category_id', '=', 'c.id')
            ->where('ua.user_id', $userId)
            ->select(['i.name as institute_name', 'c.name as category_name', 'ua.id_card_path'])
            ->first();

        $supervisor = DB::table('user_supervisors as us')
            ->join('users as u', 'us.supervisor_id', '=', 'u.user_id')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->where('us.user_id', $userId)
            ->where('us.is_active', true)
            ->select(DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as supervisor_name"))
            ->first();

        return [
            'personal' => $profile ? [
                'title' => $profile->title,
                'first_name' => $profile->first_name,
                'middle_name' => $profile->middle_name,
                'last_name' => $profile->last_name,
                'date_of_birth' => $profile->date_of_birth,
                'gender' => $profile->gender,
            ] : null,
            'qualification' => $qualification ? [
                'highest_qualification' => $qualification->highest_qualification,
                'field_of_study' => $qualification->field_of_study,
                'university' => $qualification->university,
                'graduation_year' => $qualification->graduation_year,
                'graduation_month' => $qualification->graduation_month,
            ] : null,
            'contact' => $contact ? [
                'address_line_1' => $contact->address_line_1,
                'address_line_2' => $contact->address_line_2,
                'address_line_3' => $contact->address_line_3,
                'city' => $contact->city,
                'state' => $contact->state,
                'postal_code' => $contact->postal_code,
                'country_name' => $contact->country_name,
                'phone_number' => $contact->phone_number,
            ] : null,
            'affiliation' => $affiliation ? [
                'institute_name' => $affiliation->institute_name,
                'category_name' => $affiliation->category_name,
                'id_card_path' => $affiliation->id_card_path,
            ] : null,
            'supervisor' => $supervisor ? $supervisor->supervisor_name : 'None',
        ];
    }
}
