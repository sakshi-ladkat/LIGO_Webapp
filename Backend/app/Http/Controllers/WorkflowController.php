<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class WorkflowController extends Controller
{
    // ── Slug of the "personal supervisor" role ────────────────────────────────
    // Applications at a step with this role are routed to the applicant's
    // OWN supervisor (from user_supervisors), NOT to every supervisor-role user.
    private const SUPERVISOR_ROLE_SLUG = 'supervisor';
    private static ?bool $hasApplicationsApprovedAt = null;
    private static array $applicationColumnCache = [];

    private function hasApplicationsApprovedAt(): bool
    {
        if (self::$hasApplicationsApprovedAt === null) {
            self::$hasApplicationsApprovedAt = Schema::hasColumn('applications', 'approved_at');
        }

        return self::$hasApplicationsApprovedAt;
    }

    private function hasApplicationColumn(string $column): bool
    {
        if (!array_key_exists($column, self::$applicationColumnCache)) {
            self::$applicationColumnCache[$column] = Schema::hasColumn('applications', $column);
        }

        return self::$applicationColumnCache[$column];
    }


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

        // Resolve entity-lead role IDs for entity-specific routing
        $systemLeadRoleId    = DB::table('roles')->where('slug', 'system_lead')->value('id');
        $subsystemLeadRoleId = DB::table('roles')->where('slug', 'subsystem_lead')->value('id');

        // Entity-lead role IDs that require targeted (not pool) routing
        $entityLeadRoleIds = collect(array_filter([$systemLeadRoleId, $subsystemLeadRoleId]));

        // Split caller's roles into: supervisor role vs entity-lead roles vs everything else
        $nonSupervisorRoleIds = $filteredRoleIds->filter(
            fn($rid) => $rid !== $supervisorRoleId && !$entityLeadRoleIds->contains($rid)
        )->values();

        $callerIsSupervisorRole    = $supervisorRoleId && $filteredRoleIds->contains($supervisorRoleId);
        $callerIsSystemLeadRole    = $systemLeadRoleId && $filteredRoleIds->contains($systemLeadRoleId);
        $callerIsSubsystemLeadRole = $subsystemLeadRoleId && $filteredRoleIds->contains($subsystemLeadRoleId);

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
            DB::raw("COALESCE(app.id_card_path, ua.id_card_path) as id_card_path"),
            ...($this->hasApplicationsApprovedAt() ? ['app.approved_at'] : [DB::raw('NULL as approved_at')]),
            DB::raw('NULL as approved_by_name'),
            'app.created_at as submitted_at',
            ...($this->hasApplicationColumn('ligo_member') ? ['app.ligo_member'] : [DB::raw('NULL as ligo_member')]),
            ...($this->hasApplicationColumn('duration') ? ['app.duration'] : [DB::raw('NULL as duration')]),
            ...($this->hasApplicationColumn('assigned_subsystem_lead_id') ? ['app.assigned_subsystem_lead_id'] : [DB::raw('NULL as assigned_subsystem_lead_id')]),
            ...($this->hasApplicationColumn('assigned_system_lead_id') ? ['app.assigned_system_lead_id'] : [DB::raw('NULL as assigned_system_lead_id')]),
            'app.id_card_approved_by',
        ];

        $apps = collect();

        // ── Branch A: non-supervisor steps ────────────────────────────────────
        if ($nonSupervisorRoleIds->isNotEmpty()) {
            $genericAppsQuery = DB::table('applications as app')
                ->join('workflow_steps as ws', 'app.current_step_id', '=', 'ws.workflow_step_id')
                ->join('workflows as wf', 'app.workflow_id', '=', 'wf.workflow_id')
                ->join('requests as req', 'app.request_id', '=', 'req.id')
                ->join('users as u', 'app.user_id', '=', 'u.user_id')
                ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                ->leftJoin('user_affilation as ua', 'app.user_id', '=', 'ua.user_id')
                ->join('roles as r', 'ws.role_id', '=', 'r.id');

            $genericApps = $genericAppsQuery
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
            $supervisorAppsQuery = DB::table('applications as app')
                ->join('workflow_steps as ws', 'app.current_step_id', '=', 'ws.workflow_step_id')
                ->join('workflows as wf', 'app.workflow_id', '=', 'wf.workflow_id')
                ->join('requests as req', 'app.request_id', '=', 'req.id')
                ->join('users as u', 'app.user_id', '=', 'u.user_id')
                ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                ->leftJoin('user_affilation as ua', 'app.user_id', '=', 'ua.user_id')
                ->join('roles as r', 'ws.role_id', '=', 'r.id')
                ->join('user_supervisors as usup', function ($join) use ($userId) {
                $join->on('usup.user_id', '=', 'app.user_id')
                    ->where('usup.supervisor_id', '=', $userId)
                    ->where('usup.is_active', '=', true);
            });

            $supervisorApps = $supervisorAppsQuery
                ->where('ws.role_id', $supervisorRoleId)
                ->whereNotNull('app.current_step_id')
                ->where('app.is_active', true)
                ->select($cols)
                ->orderBy('app.created_at', 'asc')
                ->get();

            $apps = $apps->merge($supervisorApps);
        }

        // ── Branch C: system_lead steps (entity-specific routing) ────────────────
        // An application at a system_lead step is shown ONLY to the user who is the
        // active lead of the system whose lead_id matches app.assigned_system_lead_id.
        if ($callerIsSystemLeadRole && $systemLeadRoleId) {
            $sysLeadApps = DB::table('applications as app')
                ->join('workflow_steps as ws', 'app.current_step_id', '=', 'ws.workflow_step_id')
                ->join('workflows as wf', 'app.workflow_id', '=', 'wf.workflow_id')
                ->join('requests as req', 'app.request_id', '=', 'req.id')
                ->join('users as u', 'app.user_id', '=', 'u.user_id')
                ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                ->leftJoin('user_affilation as ua', 'app.user_id', '=', 'ua.user_id')
                ->join('roles as r', 'ws.role_id', '=', 'r.id')
                ->where('ws.role_id', $systemLeadRoleId)
                ->whereNotNull('app.current_step_id')
                ->where('app.is_active', true)
                // Show app if: caller is the active system lead AND is the one assigned on this application
                ->where(function ($q) use ($userId) {
                    $q->whereRaw(
                        'app.assigned_system_lead_id = ? OR app.assigned_system_lead_id IS NULL',
                        [$userId]
                    );
                })
                ->whereRaw('EXISTS (
                    SELECT 1 FROM entity_assignments ea
                    WHERE ea.entity_type = ? AND ea.user_id = ? AND ea.is_active = 1
                )', ['system', $userId])
                ->select($cols)
                ->orderBy('app.created_at', 'asc')
                ->get();

            $apps = $apps->merge($sysLeadApps);
        }

        // ── Branch D: subsystem_lead steps (entity-specific routing) ─────────────
        if ($callerIsSubsystemLeadRole && $subsystemLeadRoleId) {
            $subLeadApps = DB::table('applications as app')
                ->join('workflow_steps as ws', 'app.current_step_id', '=', 'ws.workflow_step_id')
                ->join('workflows as wf', 'app.workflow_id', '=', 'wf.workflow_id')
                ->join('requests as req', 'app.request_id', '=', 'req.id')
                ->join('users as u', 'app.user_id', '=', 'u.user_id')
                ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                ->leftJoin('user_affilation as ua', 'app.user_id', '=', 'ua.user_id')
                ->join('roles as r', 'ws.role_id', '=', 'r.id')
                ->where('ws.role_id', $subsystemLeadRoleId)
                ->whereNotNull('app.current_step_id')
                ->where('app.is_active', true)
                // Show app if: caller is assigned subsystem lead on this application
                ->where(function ($q) use ($userId) {
                    $q->whereRaw(
                        'app.assigned_subsystem_lead_id = ? OR app.assigned_subsystem_lead_id IS NULL',
                        [$userId]
                    );
                })
                ->whereRaw('EXISTS (
                    SELECT 1 FROM entity_assignments ea
                    WHERE ea.entity_type = ? AND ea.user_id = ? AND ea.is_active = 1
                )', ['subsystem', $userId])
                ->select($cols)
                ->orderBy('app.created_at', 'asc')
                ->get();

            $apps = $apps->merge($subLeadApps);
        }

        $apps = $apps->unique('id')->values();

        // ── Attach previous recommendations ──
        foreach ($apps as $app) {
            $pastApprovals = DB::table('application_approvals as aa')
                ->join('users as u', 'aa.approved_by', '=', 'u.user_id')
                ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                ->join('workflow_steps as ws', 'aa.workflow_step_id', '=', 'ws.workflow_step_id')
                ->join('roles as r', 'ws.role_id', '=', 'r.id')
                ->where('aa.application_id', $app->id)
                ->whereNotNull('aa.recommended_services')
                ->select([
                    'aa.recommended_services',
                    DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as reviewer_name"),
                    'r.name as reviewer_role',
                    'aa.approved_at'
                ])
                ->get();

            $flatSvc = [];
            $flatSub = [];
            $pastReviewers = [];
            foreach ($pastApprovals as $pa) {
                $ps = json_decode($pa->recommended_services, true);
                if (!empty($ps['service_ids'])) {
                    $flatSvc = array_merge($flatSvc, $ps['service_ids']);
                }
                if (!empty($ps['subservice_ids'])) {
                    $flatSub = array_merge($flatSub, $ps['subservice_ids']);
                }
                $pastReviewers[] = [
                    'name' => $pa->reviewer_name,
                    'role' => $pa->reviewer_role,
                    'date' => $pa->approved_at
                ];
            }
            $app->recommended_service_ids = array_values(array_unique($flatSvc));
            $app->recommended_subservice_ids = array_values(array_unique($flatSub));
            $app->past_reviewers = $pastReviewers;
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
        $appQuery = DB::table('applications as app')
            ->join('workflows as wf', 'app.workflow_id', '=', 'wf.workflow_id')
            ->join('requests as req', 'app.request_id', '=', 'req.id')
            ->leftJoin('workflow_steps as ws', 'app.current_step_id', '=', 'ws.workflow_step_id')
            ->where('app.user_id', $userId);

        $app = $appQuery
            ->select([
            'app.id',
            'app.application_id',
            'app.current_step_id',
            'app.status',
            ...($this->hasApplicationsApprovedAt() ? ['app.approved_at'] : [DB::raw('NULL as approved_at')]),
            DB::raw('NULL as approved_by_name'),
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

        // 3. Resolve role IDs for entity-specific steps
        $supervisorRoleId    = DB::table('roles')->where('slug', self::SUPERVISOR_ROLE_SLUG)->value('id');
        $systemLeadRoleId    = DB::table('roles')->where('slug', 'system_lead')->value('id');
        $subsystemLeadRoleId = DB::table('roles')->where('slug', 'subsystem_lead')->value('id');

        $isPersonalSupervisorStep = ($supervisorRoleId && $stepRoleId == $supervisorRoleId);
        $isSystemLeadStep         = ($systemLeadRoleId && $stepRoleId == $systemLeadRoleId);
        $isSubsystemLeadStep      = ($subsystemLeadRoleId && $stepRoleId == $subsystemLeadRoleId);

        // 4. Authorization check
        if ($isPersonalSupervisorStep) {
            // Check if ID card is approved before supervisor can recommend
            if ($action === 'approve' && ( !isset($app->id_card_approved_by) || is_null($app->id_card_approved_by))) {
                return response()->json([
                    'error' => 'You cannot recommend this application until the applicant\'s ID card has been approved.',
                ], 422);
            }

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

            $hasRole = DB::table('user_roles')
                ->where('user_id', $userId)->where('role_id', $supervisorRoleId)->where('is_active', true)->exists();
            if (!$hasRole) {
                return response()->json(['error' => 'You are not authorised to act on this application.'], 403);
            }

        } elseif ($isSystemLeadStep) {
            // For system_lead steps: caller must be the active lead of *some* system
            // and that system's lead must match the assigned_system_lead_id on the application
            $isActiveSystemLead = DB::table('entity_assignments')
                ->where('entity_type', 'system')
                ->where('user_id', $userId)
                ->where('is_active', true)
                ->exists();

            if (!$isActiveSystemLead) {
                return response()->json(['error' => 'You are not authorised. You are not an active System Lead.'], 403);
            }

            // Verify caller is the lead specifically assigned to this application
            $assignedLeadId = $this->hasApplicationColumn('assigned_system_lead_id')
                ? ($app->assigned_system_lead_id ?? null)
                : null;

            if ($assignedLeadId && $assignedLeadId !== $userId) {
                return response()->json(['error' => 'You are not the System Lead assigned to this application.'], 403);
            }

        } elseif ($isSubsystemLeadStep) {
            // For subsystem_lead steps: caller must be the active lead of *some* subsystem
            $isActiveSubsystemLead = DB::table('entity_assignments')
                ->where('entity_type', 'subsystem')
                ->where('user_id', $userId)
                ->where('is_active', true)
                ->exists();

            if (!$isActiveSubsystemLead) {
                return response()->json(['error' => 'You are not authorised. You are not an active Subsystem Lead.'], 403);
            }

            $assignedLeadId = $this->hasApplicationColumn('assigned_subsystem_lead_id')
                ? ($app->assigned_subsystem_lead_id ?? null)
                : null;

            if ($assignedLeadId && $assignedLeadId !== $userId) {
                return response()->json(['error' => 'You are not the Subsystem Lead assigned to this application.'], 403);
            }

        } else {
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
            DB::table('application_logs')->insert([
                'application_id' => $id,
                'workflow_step_id' => $stepStepId,
                'action_by' => $userId,
                'action' => $action,
                'remarks' => $request->remarks,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            // Save ligo_member, duration, and assigned leads if provided
            // Only include columns that actually exist in the schema
            $appUpdates = [];
            if ($request->filled('ligo_member') && in_array($request->ligo_member, ['yes', 'no']) && $this->hasApplicationColumn('ligo_member')) {
                $appUpdates['ligo_member'] = $request->ligo_member;
            }
            if ($request->filled('duration') && $this->hasApplicationColumn('duration')) {
                $appUpdates['duration'] = $request->duration;
            }
            if ($request->filled('subsystem_lead_id') && $this->hasApplicationColumn('assigned_subsystem_lead_id')) {
                $appUpdates['assigned_subsystem_lead_id'] = $request->subsystem_lead_id;
            }
            if ($request->filled('system_lead_id') && $this->hasApplicationColumn('assigned_system_lead_id')) {
                $appUpdates['assigned_system_lead_id'] = $request->system_lead_id;
            }
            if (!empty($appUpdates)) {
                DB::table('applications')->where('id', $id)->update($appUpdates);
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
            \Illuminate\Support\Facades\Log::error('Workflow Decision Error: ' . $e->getMessage(), [
                'application_id' => $id,
                'user_id' => $userId,
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['error' => 'Decision could not be processed due to a system error. Please ensure you are not acting on a stale session.'], 500);
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

    /**
     * POST /api/review/applications/{id}/approve-id-card
     *
     * Approves the ID card for an application.
     */
    public function approveIdCard(Request $request, int $id): JsonResponse
    {
        $userId = $request->auth_user_id;

        // Verify if user has permission to approve ID cards
        $hasPermission = DB::table('user_roles as ur')
            ->join('roles_permissions as rp', 'ur.role_id', '=', 'rp.role_id')
            ->join('permissions as p', 'rp.permission_id', '=', 'p.id')
            ->where('ur.user_id', $userId)
            ->where('p.slug', 'approve_id_card')
            ->where('ur.is_active', true)
            ->exists();

        if (!$hasPermission) {
            // Check if Super Admin
            $isSuperAdmin = DB::table('user_roles as ur')
                ->join('roles as r', 'ur.role_id', '=', 'r.id')
                ->where('ur.user_id', $userId)
                ->where('r.slug', 'super_admin')
                ->where('ur.is_active', true)
                ->exists();
            
            if (!$isSuperAdmin) {
                return response()->json(['error' => 'You are not authorised to approve ID cards.'], 403);
            }
        }

        $app = DB::table('applications')->where('id', $id)->first();
        if (!$app) {
            return response()->json(['error' => 'Application not found.'], 404);
        }

        DB::table('applications')->where('id', $id)->update([
            'id_card_approved_by' => $userId,
            'id_card_approved_at' => now(),
            'updated_at'          => now(),
        ]);

        return response()->json(['message' => 'ID Card approved successfully.']);
    }
}