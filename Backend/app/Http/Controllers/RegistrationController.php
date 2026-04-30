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

class RegistrationController extends Controller
{
    public function submit(Request $request)
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
            Log::info('Registration Submission Started', [
                'user_id' => $userId,
                'input_keys' => array_keys($request->all()),
                'all_files' => array_map(fn($f) => [
                    'name' => $f->getClientOriginalName(),
                    'size' => $f->getSize(),
                    'mime' => $f->getMimeType()
                ], $request->allFiles()),
                'id_card_detected' => $request->hasFile('id_card'),
                'content_type' => $request->header('Content-Type')
            ]);
            DB::beginTransaction();
            
            $instituteId = $request->input('institute');
            if ($instituteId === 'other') {
                $otherName = $request->input('otherInstitute');
                if (!$otherName) {
                    DB::rollBack();
                    return response()->json(['error' => 'Please provide the custom institute name.'], 422);
                }
                
                $newInst =Institute::create([
                    'name' => $otherName,
                    'is_active' => false // Pending approval
                ]);
                $instituteId = $newInst->id;
            }

            // Sync User Affiliation logic
            if ($instituteId) {
                $affiliationData = [
                    'institute_id' => $instituteId,
                    'category_id' => $request->input('designation'),
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now()
                ];

                if ($request->hasFile('id_card')) {
                    $file = $request->file('id_card');
                    if (!$file->isValid()) {
                        DB::rollBack();
                        return response()->json(['error' => 'Invalid file upload: ' . $file->getErrorMessage()], 422);
                    }
                    $path = $file->store('id_cards');
                    $affiliationData['id_card_path'] = $path;
                    Log::info('ID Card file stored successfully', [
                        'path' => $path,
                        'size' => $file->getSize(),
                        'mime' => $file->getMimeType()
                    ]);
                } else {
                    // Check if the upload was truncated by PHP limits
                    $contentLength = (int)$request->header('Content-Length');
                    if ($contentLength > 2000000) { // > 2MB
                        DB::rollBack();
                        Log::error('Upload detected but file is missing. This usually means the file exceeds PHP upload_max_filesize (currently 2MB).', [
                            'content_length' => $contentLength,
                            'upload_max_filesize' => ini_get('upload_max_filesize')
                        ]);
                        return response()->json([
                            'error' => 'The ID card file is too large for the server. Please upload an image smaller than 2MB or increase server limits.'
                        ], 422);
                    }

                    DB::rollBack();
                    return response()->json(['error' => 'Identity Card is required for registration.'], 422);
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
            $targetWorkflow = DB::table('workflow_category_mappings')
                ->where('request_id', $requestId)
                ->where('category_id', $request->input('designation'))
                ->first();
                
            $workflowId = $targetWorkflow ? $targetWorkflow->workflow_id : null;
            
            // 4. Mount Application dynamically into the routing pipeline
            if ($workflowId) {
                $firstStep = DB::table('workflow_steps')
                    ->where('workflow_id', $workflowId)
                    ->orderBy('step_no', 'asc')
                    ->first();
                
                $applicationId = DB::table('applications')->updateOrInsert(
                    ['user_id' => $userId, 'request_id' => $requestId],
                    [
                        'application_id' => uniqid('APP-'),
                        'workflow_id' => $workflowId,
                        'current_step_id' => $firstStep ? $firstStep->workflow_step_id : null,
                        'status' => 'registered',
                        'id_card_path' => $affiliationData['id_card_path'] ?? null,
                        'is_active' => true,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]
                );

                // Fetch the actual application record to get its primary ID
                $appRecord = DB::table('applications')
                    ->where('user_id', $userId)
                    ->where('request_id', $requestId)
                    ->first();

                if ($appRecord) {
                    // Pre-create all approval entries for transparency
                    $allSteps = DB::table('workflow_steps')
                        ->where('workflow_id', $workflowId)
                        ->orderBy('step_no', 'asc')
                        ->get();

                    foreach ($allSteps as $ws) {
                        DB::table('application_approvals')->updateOrInsert(
                            ['application_id' => $appRecord->id, 'workflow_step_id' => $ws->workflow_step_id],
                            [
                                'status' => 'pending',
                                'created_at' => now(),
                                'updated_at' => now()
                            ]
                        );
                    }
                }
            }

            // 3. Complete Profile Demographics Sync
            $titleName = Title::find($request->input('title'))?->name ?? $request->input('title', 'Unknown');
            DB::table('user_profiles')->updateOrInsert(
                ['user_id' => $userId],
                [
                    'title' => $titleName,
                    'first_name' => $request->input('firstName', 'Unknown'),
                    'middle_name' => $request->input('middleName'),
                    'last_name' => $request->input('lastName', 'Unknown'),
                    'date_of_birth' => $request->input('dob', now()->toDateString()),
                    'gender' => strtolower($request->input('gender', 'prefer-not-to-say')),
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );

            // 4. Academic Sync
            DB::table('user_qualification')->updateOrInsert(
                ['user_id' => $userId],
                [
                    'highest_qualification' => $request->input('highestDegree', 'None'),
                    'field_of_study' => $request->input('fieldOfStudy', 'None'),
                    'university' => $request->input('institutionAwarded', 'None'),
                    'graduation_year' => $request->input('graduationYear') ?: date('Y'),
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );

            // 5. Contact Logistics Sync
            DB::table('user_contacts')->updateOrInsert(
                ['user_id' => $userId],
                [
                    'continent_name' => Continent::find($request->input('continent'))?->name ?? 'Unknown',
                    'country_name' => Country::find($request->input('country'))?->name ?? 'Unknown',
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

            DB::commit();

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
}