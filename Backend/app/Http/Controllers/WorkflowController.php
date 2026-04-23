<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class WorkflowController extends Controller
{
    // ── Slug of the "personal supervisor" role ────────────────────────────────
    // Applications at a step with this role are routed to the applicant's
    // OWN supervisor (from user_supervisors), NOT to every supervisor-role user.
    private const SUPERVISOR_ROLE_SLUG = 'supervisor';


    /**
     * GET /api/auth/review/staff/{roleSlug}
     *
     * Returns users who actively hold a given role (e.g. subsystem_lead, system_lead).
     * Used to populate assignment dropdowns in the review modal.
     */
    public function staffByRole(string $roleSlug): JsonResponse
    {
        $staff = DB::table('users as u')
            ->join('user_roles as ur', 'u.user_id', '=', 'ur.user_id')
            ->join('roles as r', 'ur.role_id', '=', 'r.id')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->where('r.slug', $roleSlug)
            ->where('ur.is_active', true)
            ->where('u.status', '!=', 'deactivated')
            ->select([
            'u.user_id as id',
            DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as name"),
            'u.email',
        ])
            ->orderBy('name')
            ->get();

        return response()->json($staff);
    }

    /**
     * GET /api/auth/review/applicant/{userId}
     *
     * Returns a rich profile snapshot of an applicant for the modal right panel.
     */
    public function applicantProfile(string $userId): JsonResponse
    {
        $profile = DB::table('users as u')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->leftJoin('user_contacts as uc', 'u.user_id', '=', 'u.user_id')
            ->leftJoin('user_qualification as uq', 'u.user_id', '=', 'uq.user_id')
            ->leftJoin('user_affilation as ua', 'u.user_id', '=', 'ua.user_id')
            ->leftJoin('institutes as i', 'ua.institute_id', '=', 'i.id')
            ->leftJoin('categories as cat', 'ua.category_id', '=', 'cat.id')
            ->where('u.user_id', $userId)
            ->select([
            'u.email',
            'u.status',
            'up.title', 'up.first_name', 'up.last_name', 'up.gender', 'up.date_of_birth',
            'uq.highest_qualification', 'uq.field_of_study', 'uq.university', 'uq.graduation_year',
            'uc.country_name', 'uc.city', 'uc.phone_number',
            'i.name as institute_name',
            'cat.name as designation',
            'ua.id_card_path',
        ])
            ->first();

        if (!$profile) {
            return response()->json(['error' => 'Applicant not found.'], 404);
        }

        return response()->json($profile);
    }

    /**
     * GET /api/review/applications
     *
     * Returns all applications that the authenticated user is authorised to review.
     *
     * Logic:
     *  A) For steps that require the generic reviewer pool (any role except
     *     SUPERVISOR_ROLE_SLUG) → return apps whose current step role_id is one
     *     of the caller's active role IDs.
     *
     *  B) For steps that require role = SUPERVISOR_ROLE_SLUG → an application is
     *     included ONLY if the caller is the personal supervisor of that applicant
     *     (i.e. a row exists in user_supervisors where supervisor_id = caller).
     *
     * Optional ?role_slug= narrows results to a specific role.
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->auth_user_id;

        // ── A. Generic reviewer pool ──────────────────────────────────────────
        // Fetch the caller's active role IDs
        $userRoleIds = DB::table('user_roles')
            ->where('user_id', $userId)
            ->where('is_active', true)
            ->pluck('role_id');

        if ($userRoleIds->isEmpty()) {
            return response()->json([]);
        }

        // Narrow by ?role_slug= when provided
        $filteredRoleIds = $userRoleIds;
        if ($request->filled('role_slug')) {
            $filteredRoleIds = DB::table('roles')
                ->whereIn('id', $userRoleIds)
                ->where('slug', $request->role_slug)
                ->pluck('id');

            if ($filteredRoleIds->isEmpty()) {
                return response()->json([]);
            }
        }

        // Resolve the supervisor role ID (may be null if role not seeded yet)
        $supervisorRoleId = DB::table('roles')
            ->where('slug', self::SUPERVISOR_ROLE_SLUG)
            ->value('id');

        // Split caller's roles into: supervisor role vs everything else
        $nonSupervisorRoleIds = $filteredRoleIds->filter(
        fn($rid) => $rid !== $supervisorRoleId
        )->values();

        $callerIsSupervisorRole = $supervisorRoleId
            && $filteredRoleIds->contains($supervisorRoleId);

        // ── Build the base select columns shared by both branches ─────────────
        $cols = [
            'app.id',
            'app.application_id',
            'app.user_id as applicant_user_id',
            DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as applicant_name"),
            'u.email as applicant_email',
            'req.name as request_name',
            'wf.workflow_name',
            'ws.status_name as current_status',
            'ws.step_action',
            'ws.workflow_step_id as step_id',
            'r.slug as role_slug',
            'r.name as role_name',
            'app.status',
            'app.approved_at',
            DB::raw("COALESCE(CONCAT(approver_profile.first_name, ' ', approver_profile.last_name), approver.email) as approved_by_name"),
            'app.created_at as submitted_at',
            'app.ligo_member',
        ];

        $apps = collect();

        // ── Branch A: non-supervisor steps ────────────────────────────────────
        if ($nonSupervisorRoleIds->isNotEmpty()) {
            $genericApps = DB::table('applications as app')
                ->join('workflow_steps as ws', 'app.current_step_id', '=', 'ws.workflow_step_id')
                ->join('workflows as wf', 'app.workflow_id', '=', 'wf.workflow_id')
                ->join('requests as req', 'app.request_id', '=', 'req.id')
                ->join('users as u', 'app.user_id', '=', 'u.user_id')
                ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                ->join('roles as r', 'ws.role_id', '=', 'r.id')
                ->leftJoin('users as approver', 'app.approved_by', '=', 'approver.user_id')
                ->leftJoin('user_profiles as approver_profile', 'approver.user_id', '=', 'approver_profile.user_id')
                ->whereIn('ws.role_id', $nonSupervisorRoleIds)
                ->whereNotNull('app.current_step_id')
                ->where('app.is_active', true)
                ->select($cols)
                ->orderBy('app.created_at', 'asc')
                ->get();

            $apps = $apps->merge($genericApps);
        }

        // ── Branch B: supervisor steps (personal routing) ─────────────────────
        if ($callerIsSupervisorRole && $supervisorRoleId) {
            $supervisorApps = DB::table('applications as app')
                ->join('workflow_steps as ws', 'app.current_step_id', '=', 'ws.workflow_step_id')
                ->join('workflows as wf', 'app.workflow_id', '=', 'wf.workflow_id')
                ->join('requests as req', 'app.request_id', '=', 'req.id')
                ->join('users as u', 'app.user_id', '=', 'u.user_id')
                ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                ->join('roles as r', 'ws.role_id', '=', 'r.id')
                ->leftJoin('users as approver', 'app.approved_by', '=', 'approver.user_id')
                ->leftJoin('user_profiles as approver_profile', 'approver.user_id', '=', 'approver_profile.user_id')
                ->join('user_supervisors as usup', function ($join) use ($userId) {
                $join->on('usup.user_id', '=', 'app.user_id')
                    ->where('usup.supervisor_id', '=', $userId)
                    ->where('usup.is_active', '=', true);
            })
                ->where('ws.role_id', $supervisorRoleId)
                ->whereNotNull('app.current_step_id')
                ->where('app.is_active', true)
                ->select($cols)
                ->orderBy('app.created_at', 'asc')
                ->get();

            $apps = $apps->merge($supervisorApps);
        }

        $apps = $apps->unique('id')->values();

        // ── Attach previous recommendations ──
        foreach ($apps as $app) {
            $pastServices = DB::table('application_approvals')
                ->where('application_id', $app->id)
                ->whereNotNull('recommended_services')
                ->pluck('recommended_services')
                ->map(fn($json) => json_decode($json, true))
                ->toArray();

            $flatSvc = [];
            $flatSub = [];
            foreach ($pastServices as $ps) {
                if (!empty($ps['service_ids'])) {
                    $flatSvc = array_merge($flatSvc, $ps['service_ids']);
                }
                if (!empty($ps['subservice_ids'])) {
                    $flatSub = array_merge($flatSub, $ps['subservice_ids']);
                }
            }
            $app->recommended_service_ids = array_values(array_unique($flatSvc));
            $app->recommended_subservice_ids = array_values(array_unique($flatSub));
        }

        return response()->json($apps);
    }

    /**
     * GET /api/review/my-application
     *
     * Returns the authenticated user's most recent application
     * plus all workflow steps for that workflow (for timeline rendering).
     */
    public function myApplication(Request $request): JsonResponse
    {
        $userId = $request->auth_user_id;

        /** @var object|null $app */
        $app = DB::table('applications as app')
            ->join('workflows as wf', 'app.workflow_id', '=', 'wf.workflow_id')
            ->join('requests as req', 'app.request_id', '=', 'req.id')
            ->leftJoin('workflow_steps as ws', 'app.current_step_id', '=', 'ws.workflow_step_id')
            ->leftJoin('users as approver', 'app.approved_by', '=', 'approver.user_id')
            ->leftJoin('user_profiles as approver_profile', 'approver.user_id', '=', 'approver_profile.user_id')
            ->where('app.user_id', $userId)
            ->select([
            'app.id',
            'app.application_id',
            'app.current_step_id',
            'app.status',
            'app.approved_at',
            DB::raw("COALESCE(CONCAT(approver_profile.first_name, ' ', approver_profile.last_name), approver.email) as approved_by_name"),
            'app.created_at as submitted_at',
            'app.workflow_id',
            'wf.workflow_name',
            'req.name as request_name',
            'ws.status_name as current_status',
            'ws.step_no    as current_step_no',
        ])
            ->orderByDesc('app.created_at')
            ->first();

        if (!$app) {
            return response()->json(null);
        }

        /** @var mixed $appWorkflowId */
        $appWorkflowId = $app->workflow_id;

        // All steps for this workflow — lets the frontend draw the full timeline
        $steps = DB::table('workflow_steps')
            ->where('workflow_id', $appWorkflowId)
            ->orderBy('step_no')
            ->get(['workflow_step_id', 'step_no', 'status_name', 'step_action']);

        // Fetch step-level approvals
        $approvals = DB::table('application_approvals as aa')
            ->join('users as u', 'aa.approved_by', '=', 'u.user_id')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->where('aa.application_id', $app->id)
            ->where('aa.status', 'approved')
            ->select([
                'aa.workflow_step_id',
                'aa.approved_at',
                DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as approved_by_name")
            ])
            ->get()
            ->keyBy('workflow_step_id');

        $mappedSteps = $steps->map(function ($step) use ($approvals) {
            $step->approved_by_name = $approvals->has($step->workflow_step_id) 
                ? $approvals->get($step->workflow_step_id)->approved_by_name 
                : null;
            $step->approved_at = $approvals->has($step->workflow_step_id) 
                ? $approvals->get($step->workflow_step_id)->approved_at 
                : null;
            return $step;
        });

        return response()->json([
            'application' => $app,
            'steps' => $mappedSteps,
        ]);
    }

    /**
     * POST /api/review/applications/{id}/decide
     *
     * Approve or reject an application at its current workflow step.
     * - approve  → advance to next step (or mark complete & activate user)
     * - reject   → terminate workflow, mark user as rejected
     *
     * Authorization for supervisor steps: caller must be the personal
     * supervisor of the applicant (user_supervisors lookup), not merely any
     * user holding the supervisor role.
     */
    public function decide(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'action' => 'required|in:approve,reject',
            'remarks' => 'nullable|string|max:1000',
        ]);

        $userId = $request->auth_user_id;
        $action = $request->action;

        // 1. Fetch the application
        /** @var object|null $app */
        $app = DB::table('applications')->where('id', $id)->first();
        if (!$app) {
            return response()->json(['error' => 'Application not found.'], 404);
        }

        if ($app->status === 'approved') {
            return response()->json(['error' => 'Already approved'], 400);
        }

        /** @var mixed $currentStepId */
        $currentStepId = $app->current_step_id ?? null;
        if (is_null($currentStepId)) {
            return response()->json(['error' => 'This application has already been fully processed.'], 422);
        }

        // 2. Fetch the current workflow step
        /** @var object|null $step */
        $step = DB::table('workflow_steps')
            ->where('workflow_step_id', $currentStepId)
            ->first();

        if (!$step) {
            return response()->json(['error' => 'Workflow step not found.'], 404);
        }

        /** @var mixed $stepRoleId */
        $stepRoleId = $step->role_id;
        /** @var mixed $stepStepNo */
        $stepStepNo = $step->step_no;
        /** @var mixed $stepStepId */
        $stepStepId = $step->workflow_step_id;
        /** @var mixed $appWorkflowId */
        $appWorkflowId = $app->workflow_id;
        /** @var mixed $appUserId */
        $appUserId = $app->user_id;

        // 3. Resolve the supervisor role ID
        $supervisorRoleId = DB::table('roles')
            ->where('slug', self::SUPERVISOR_ROLE_SLUG)
            ->value('id');

        $isPersonalSupervisorStep = ($supervisorRoleId && $stepRoleId == $supervisorRoleId);

        // 4. Authorization check
        if ($isPersonalSupervisorStep) {
            // For supervisor steps: caller must be the applicant's personal supervisor
            $isAssignedSupervisor = DB::table('user_supervisors')
                ->where('user_id', $appUserId)
                ->where('supervisor_id', $userId)
                ->where('is_active', true)
                ->exists();

            if (!$isAssignedSupervisor) {
                return response()->json([
                    'error' => 'You are not authorised to act on this application. You are not the registered supervisor of this applicant.',
                ], 403);
            }

            // Also ensure the caller actually holds the supervisor role
            $hasRole = DB::table('user_roles')
                ->where('user_id', $userId)
                ->where('role_id', $supervisorRoleId)
                ->where('is_active', true)
                ->exists();

            if (!$hasRole) {
                return response()->json([
                    'error' => 'You are not authorised to act on this application.',
                ], 403);
            }
        }
        else {
            // For all other steps: caller just needs to hold the required role
            $hasRole = DB::table('user_roles')
                ->where('user_id', $userId)
                ->where('role_id', $stepRoleId)
                ->where('is_active', true)
                ->exists();

            if (!$hasRole) {
                return response()->json(['error' => 'You are not authorised to act on this application.'], 403);
            }
        }

        DB::beginTransaction();
        try {
            // 5. Log the action
            $currentRoleSlug = DB::table('roles')->where('id', $stepRoleId)->value('slug') ?? 'unknown';
            
            DB::table('application_logs')->insert([
                'application_id' => $id,
                'workflow_step_id' => $stepStepId,
                'action_by' => $userId,
                'role' => $currentRoleSlug,
                'action' => $action,
                'remarks' => $request->remarks,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Save ligo_member if provided
            if ($request->filled('ligo_member') && in_array($request->ligo_member, ['yes', 'no'])) {
                DB::table('applications')->where('id', $id)->update([
                    'ligo_member' => $request->ligo_member
                ]);
            }

            if ($action === 'approve') {
                // 6a. Find the next sequential step
                /** @var object|null $nextStep */
                $nextStep = DB::table('workflow_steps')
                    ->where('workflow_id', $appWorkflowId)
                    ->where('step_no', $stepStepNo + 1)
                    ->first();

                $nextStepId = $nextStep ? $nextStep->workflow_step_id : null;

                DB::table('applications')->where('id', $id)->update([
                    'current_step_id' => $nextStepId,
                    'updated_at' => now(),
                ]);

                // Update the approval record for the current step
                DB::table('application_approvals')
                    ->where('application_id', $id)
                    ->where('workflow_step_id', $stepStepId)
                    ->update([
                    'status' => 'approved',
                    'approved_by' => $userId,
                    'approved_at' => now(),
                    'recommended_services' => json_encode([
                        'service_ids' => $request->service_ids ?? [],
                        'subservice_ids' => $request->subservice_ids ?? []
                    ]),
                    'updated_at' => now(),
                ]);

                // If supervisor approved, mark the supervisor relationship as endorsed
                if ($isPersonalSupervisorStep) {
                    DB::table('user_supervisors')
                        ->where('user_id', $appUserId)
                        ->where('supervisor_id', $userId)
                        ->update(['is_active' => true, 'updated_at' => now()]);
                }

                if (!$nextStep) {
                    // Workflow complete — activate the applicant's account
                    User::where('user_id', $appUserId)->update(['status' => 'active']);
                    DB::table('applications')->where('id', $id)->update([
                        'status' => 'approved',
                        'approved_by' => $userId,
                        'approved_at' => now(),
                        'updated_at' => now(),
                    ]);
                    $message = 'Application approved. Workflow complete — account activated.';
                }
                else {
                    /** @var mixed $nextStatusName */
                    $nextStatusName = $nextStep->status_name;
                    $message = "Application approved. Moved to: {$nextStatusName}.";
                }

            }
            else {
                // 6b. Reject — terminate the workflow
                DB::table('applications')->where('id', $id)->update([
                    'status' => 'rejected',
                    'is_active' => false,
                    'current_step_id' => null,
                    'updated_at' => now(),
                ]);

                // Update the approval record for the current step
                DB::table('application_approvals')
                    ->where('application_id', $id)
                    ->where('workflow_step_id', $stepStepId)
                    ->update([
                    'status' => 'rejected',
                    'approved_by' => $userId,
                    'approved_at' => now(),
                    'updated_at' => now(),
                ]);

                User::where('user_id', $appUserId)->update(['status' => 'rejected']);
                $message = 'Application rejected.';
            }

            DB::commit();
            return response()->json(['message' => $message]);

        }
        catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * GET /api/applications/pending-with-reminders
     *
     * Returns pending applications eagerly loaded with reminders.
     */
    public function pendingWithReminders(): JsonResponse
    {
        $pendingApps = \App\Models\Application::with('reminders')
            ->whereNotIn('status', ['approved', 'completed', 'rejected', 'deactivated'])
            ->get()
            ->map(function ($app) {
                // Get the latest reminder sorted by sent_at
                $latestReminder = $app->reminders->sortByDesc('sent_at')->first();

                return [
                    'id'               => $app->id,
                    'application_id'   => $app->application_id,
                    'status'           => $app->status,
                    'submitted_at'     => $app->created_at, // Mapping created_at as submitted_at
                    'latest_reminder'  => $latestReminder ? $latestReminder->sent_at : null,
                    'reminder_sent'    => $latestReminder ? true : false,
                    'reminders'        => $app->reminders,
                ];
            });

        return response()->json($pendingApps);
    }
}