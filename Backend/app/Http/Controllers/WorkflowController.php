<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Collection;
use App\Mail\ApplicationApprovalMail;
use App\Mail\ApplicationFinalMail;
use App\Mail\ApplicationRejectionMail;
use App\Mail\ApplicationProgressMail;



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
                'up.title',
                'up.first_name',
                'up.last_name',
                'up.gender',
                'up.date_of_birth',
                'uq.highest_qualification',
                'uq.field_of_study',
                'uq.university',
                'uq.graduation_year',
                'uc.country_name',
                'uc.city',
                'uc.phone_number',
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
        $roleSlug = $request->query('role', $request->query('role_slug'));
        $userRoleIds = \DB::table('user_roles')->where('user_id', $userId)->where('is_active', true)->pluck('role_id');
        \Log::info('WorkflowController@index called', ['user_id' => $userId, 'role_slug' => $roleSlug, 'roles' => $userRoleIds]);
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

        // Narrow by ?role= or ?role_slug= when provided
        $filteredRoleIds = $userRoleIds;
        if ($roleSlug) {
            $filteredRoleIds = DB::table('roles')
                ->whereIn('id', $userRoleIds)
                ->where('slug', $roleSlug)
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
        $systemLeadRoleId = DB::table('roles')->where('slug', 'system_lead')->value('id');
        $subsystemLeadRoleId = DB::table('roles')->where('slug', 'subsystem_lead')->value('id');

        // Entity-lead role IDs that require targeted (not pool) routing
        $entityLeadRoleIds = collect(array_filter([$systemLeadRoleId, $subsystemLeadRoleId]));

        // Split caller's roles into: supervisor role vs entity-lead roles vs everything else
        $nonSupervisorRoleIds = $filteredRoleIds->filter(
            fn($rid) => $rid !== $supervisorRoleId && !$entityLeadRoleIds->contains($rid)
        )->values();

        $callerIsSupervisorRole = $supervisorRoleId && $filteredRoleIds->contains($supervisorRoleId);
        $callerIsSystemLeadRole = $systemLeadRoleId && $filteredRoleIds->contains($systemLeadRoleId);
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
            ...($this->hasApplicationColumn('assigned_subsystem_id') ? ['app.assigned_subsystem_id'] : [DB::raw('NULL as assigned_subsystem_id')]),
            ...($this->hasApplicationColumn('assigned_system_id') ? ['app.assigned_system_id'] : [DB::raw('NULL as assigned_system_id')]),
            'app.id_card_approved_by',
            'app.id_card_approved_at',
            DB::raw("(SELECT COALESCE(CONCAT(up.first_name, ' ', up.last_name), u2.email) FROM users u2 LEFT JOIN user_profiles up ON u2.user_id = up.user_id WHERE u2.user_id = app.id_card_approved_by) as id_card_approved_by_name"),
            DB::raw("(SELECT r.name FROM roles r JOIN user_roles ur ON r.id = ur.role_id WHERE ur.user_id = app.id_card_approved_by AND ur.is_active = 1 LIMIT 1) as id_card_approved_by_role"),
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
                // Filter: Caller is the lead of the system assigned to this application
                ->whereRaw('EXISTS (
                    SELECT 1 FROM entity_assignments ea
                    WHERE ea.entity_type = "system" 
                    AND ea.user_id = ? 
                    AND (ea.entity_id = app.assigned_system_id OR app.assigned_system_id IS NULL)
                    AND ea.is_active = 1
                )', [$userId])
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
                // Filter: Caller is the lead of the subsystem assigned to this application
                ->whereRaw('EXISTS (
                    SELECT 1 FROM entity_assignments ea
                    WHERE ea.entity_type = "subsystem" 
                    AND ea.user_id = ? 
                    AND (ea.entity_id = app.assigned_subsystem_id OR app.assigned_subsystem_id IS NULL)
                    AND ea.is_active = 1
                )', [$userId])
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
                    'aa.remarks',
                    'aa.duration',
                    DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as reviewer_name"),
                    'r.name as reviewer_role',
                    'aa.approved_at'
                ])
                ->orderBy('aa.approved_at', 'asc')
                ->get();

            $pastReviewers = [];
            foreach ($pastApprovals as $pa) {
                $ps = json_decode($pa->recommended_services, true);
                $pastReviewers[] = [
                    'name' => $pa->reviewer_name,
                    'role' => $pa->reviewer_role,
                    'date' => $pa->approved_at,
                    'remarks' => $pa->remarks ?? null,
                    'duration' => $pa->duration ?? null,
                    'service_ids' => $ps['service_ids'] ?? [],
                    'subservice_ids' => $ps['subservice_ids'] ?? []
                ];
            }

            if (count($pastReviewers) > 0) {
                $mostRecent = end($pastReviewers);
                $app->recommended_service_ids = $mostRecent['service_ids'] ?? [];
                $app->recommended_subservice_ids = $mostRecent['subservice_ids'] ?? [];
            } else {
                $app->recommended_service_ids = [];
                $app->recommended_subservice_ids = [];
            }
            $app->past_reviewers = $pastReviewers;
        }




        \Log::info('WorkflowController@index result', ['count' => $apps->count(), 'roles' => $roleSlug]);
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
        $userId = $request->query('user_id', $request->auth_user_id);



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
                'aa.remarks',
                'aa.recommended_services',
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
            $step->remarks = $approvals->has($step->workflow_step_id)
                ? $approvals->get($step->workflow_step_id)->remarks
                : null;
            $step->recommended_services = $approvals->has($step->workflow_step_id)
                ? json_decode($approvals->get($step->workflow_step_id)->recommended_services, true)
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
     * Approve or decline an application at its current workflow step.
     * - approve  → advance to next step (or mark complete & activate user)
     * - decline   → terminate workflow, mark user as declined
     *
     * Authorization for supervisor steps: caller must be the personal
     * supervisor of the applicant (user_supervisors lookup), not merely any
     * user holding the supervisor role.
     */
    public function decide(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'action' => 'required|in:approve,decline',
            'remarks' => 'nullable|string|max:1000',
            'rejection_reason' => 'required_if:action,decline|nullable|string',
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
        $supervisorRoleId = DB::table('roles')->where('slug', self::SUPERVISOR_ROLE_SLUG)->value('id');
        $systemLeadRoleId = DB::table('roles')->where('slug', 'system_lead')->value('id');
        $subsystemLeadRoleId = DB::table('roles')->where('slug', 'subsystem_lead')->value('id');

        $isPersonalSupervisorStep = ($supervisorRoleId && $stepRoleId == $supervisorRoleId);
        $isSystemLeadStep = ($systemLeadRoleId && $stepRoleId == $systemLeadRoleId);
        $isSubsystemLeadStep = ($subsystemLeadRoleId && $stepRoleId == $subsystemLeadRoleId);

        // 4. Authorization check
        if ($isPersonalSupervisorStep) {
            // Check if ID card is approved before supervisor can recommend
            if ($action === 'approve' && !empty($app->id_card_path) && is_null($app->id_card_approved_by)) {
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
            // For system_lead steps: caller must be the active lead of the specifically assigned system
            $assignedSystemId = $app->assigned_system_id ?? null;
            if (!$assignedSystemId) {
                return response()->json(['error' => 'No system assigned to this application.'], 400);
            }

            $isCorrectLead = DB::table('entity_assignments')
                ->where('entity_type', 'system')
                ->where('entity_id', $assignedSystemId)
                ->where('user_id', $userId)
                ->where('is_active', true)
                ->exists();

            if (!$isCorrectLead) {
                return response()->json(['error' => 'You are not the System Lead assigned to this system.'], 403);
            }

        } elseif ($isSubsystemLeadStep) {
            // For subsystem_lead steps: caller must be the active lead of the specifically assigned subsystem
            $assignedSubsystemId = $app->assigned_subsystem_id ?? null;
            if (!$assignedSubsystemId) {
                return response()->json(['error' => 'No subsystem assigned to this application.'], 400);
            }

            $isCorrectLead = DB::table('entity_assignments')
                ->where('entity_type', 'subsystem')
                ->where('entity_id', $assignedSubsystemId)
                ->where('user_id', $userId)
                ->where('is_active', true)
                ->exists();

            if (!$isCorrectLead) {
                return response()->json(['error' => 'You are not the Subsystem Lead assigned to this subsystem.'], 403);
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
            if ($request->filled('subsystem_id') && $this->hasApplicationColumn('assigned_subsystem_id')) {
                $appUpdates['assigned_subsystem_id'] = $request->subsystem_id;
            }
            if ($request->filled('system_id') && $this->hasApplicationColumn('assigned_system_id')) {
                $appUpdates['assigned_system_id'] = $request->system_id;
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
                        'remarks' => $request->remarks,
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

                // Fetch data for emails
                $applicantUser = User::where('user_id', $appUserId)->first();
                $applicantProfile = DB::table('user_profiles')->where('user_id', $appUserId)->first();
                $applicantName = $applicantProfile ? ($applicantProfile->first_name . ' ' . $applicantProfile->last_name) : ($applicantUser->email ?? 'Applicant');

                if (!$nextStep) {
                    // Workflow complete — activate the applicant's account

                    // Generate unique username
                    $usernameService = new \App\Services\UsernameService();
                    $firstName = $applicantProfile->first_name ?? 'user';
                    $lastName = $applicantProfile->last_name ?? 'name';
                    // We might need middle name if available in profile
                    $username = $usernameService->generateUnique($firstName, $lastName);

                    User::where('user_id', $appUserId)->update([
                        'status' => 'active',
                        'username' => $username
                    ]);

                    DB::table('applications')->where('id', $id)->update([
                        'status' => $roleSlug === 'li_coordinator' ? 'approved_by_li_coordinator' : 'approved',
                        'approved_by' => $userId,
                        'approved_at' => now(),
                        'updated_at' => now(),
                    ]);

                    // Check if computing services are enabled for this application
                    $allApprovals = DB::table('application_approvals')->where('application_id', $id)->get();
                    $isComputingEnabled = false;
                    foreach ($allApprovals as $approval) {
                        $recs = json_decode($approval->recommended_services, true);
                        $svcIds = $recs['service_ids'] ?? [];
                        if (!empty($svcIds)) {
                            $hasComp = DB::table('services')->whereIn('id', $svcIds)->where('is_computing', true)->exists();
                            if ($hasComp) {
                                $isComputingEnabled = true;
                                break;
                            }
                        }
                    }

                    // Store computing flag in application if column exists, or just rely on status
                    if ($this->hasApplicationColumn('computing_services')) {
                        DB::table('applications')->where('id', $id)->update(['computing_services' => $isComputingEnabled]);
                    }

                    $message = 'Application approved. Workflow complete — account activated.';

                    // EMAIL: Final Approval to User
                    if ($applicantUser && $applicantUser->email) {
                        Mail::to($applicantUser->email)->queue(new ApplicationFinalMail($applicantName, $app->application_id));

                        // AUDIT: Log email trigger
                        DB::table('application_logs')->insert([
                            'application_id' => $id,
                            'workflow_step_id' => $stepStepId,
                            'action_by' => $userId,
                            'action' => 'email_triggered',
                            'remarks' => "Final approval email queued for applicant: {$applicantUser->email}",
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }
                } else {
                    /** @var mixed $nextStatusName */
                    $nextStatusName = $nextStep->status_name;
                    $message = "Application approved. Moved to: {$nextStatusName}.";

                    // EMAIL: Notify applicant that their application moved to the next stage
                    if ($applicantUser && $applicantUser->email) {
                        Mail::to($applicantUser->email)->queue(new ApplicationProgressMail(
                            $applicantName,
                            $app->application_id,
                            $step->status_name,
                            $nextStatusName
                        ));

                        // AUDIT: Log email trigger
                        DB::table('application_logs')->insert([
                            'application_id' => $id,
                            'workflow_step_id' => $stepStepId,
                            'action_by' => $userId,
                            'action' => 'email_triggered',
                            'remarks' => "Progress update email queued for applicant: {$applicantUser->email}",
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]);
                    }

                    // EMAIL: Notify next level authority
                    if ($nextStep) {
                        $nextRoleId = $nextStep->role_id;
                        $isNextSystemLead = ($systemLeadRoleId && $nextRoleId == $systemLeadRoleId);
                        $isNextSubsystemLead = ($subsystemLeadRoleId && $nextRoleId == $subsystemLeadRoleId);

                        $approverEmails = [];

                        if ($isNextSystemLead) {
                            $systemId = DB::table('applications')->where('id', $id)->value('assigned_system_id');
                            $leadId = $systemId ? DB::table('entity_assignments')
                                ->where('entity_type', 'system')
                                ->where('entity_id', $systemId)
                                ->where('is_active', true)
                                ->value('user_id') : null;
                            if ($leadId) {
                                $approverEmails[] = User::where('user_id', $leadId)->value('email');
                            }
                        } elseif ($isNextSubsystemLead) {
                            $subsystemId = DB::table('applications')->where('id', $id)->value('assigned_subsystem_id');
                            $leadId = $subsystemId ? DB::table('entity_assignments')
                                ->where('entity_type', 'subsystem')
                                ->where('entity_id', $subsystemId)
                                ->where('is_active', true)
                                ->value('user_id') : null;
                            if ($leadId) {
                                $approverEmails[] = User::where('user_id', $leadId)->value('email');
                            }
                        } else {
                            $nextRoleSlug = DB::table('roles')->where('id', $nextRoleId)->value('slug');
                            if ($nextRoleSlug === 'li_coordinator') {
                                $assignmentService = new \App\Services\WorkflowAssignmentService();
                                $assignedUserId = $assignmentService->assignToLiCoordinator($id);
                                if ($assignedUserId) {
                                    // Create the approval record for the assigned LI Coordinator
                                    DB::table('application_approvals')->updateOrInsert(
                                        ['application_id' => $id, 'workflow_step_id' => $nextStep->workflow_step_id],
                                        ['status' => 'pending', 'approver_id' => $assignedUserId, 'updated_at' => now(), 'created_at' => now()]
                                    );
                                    $approverEmails = [User::where('user_id', $assignedUserId)->value('email')];
                                }
                            }

                            if (empty($approverEmails)) {
                                $approverEmails = DB::table('users')
                                    ->join('user_roles', 'users.user_id', '=', 'user_roles.user_id')
                                    ->where('user_roles.role_id', $nextRoleId)
                                    ->where('user_roles.is_active', true)
                                    ->pluck('email')
                                    ->toArray();
                            }
                        }

                        foreach (array_filter($approverEmails) as $approverEmail) {
                            Mail::to($approverEmail)->queue(new ApplicationApprovalMail(
                                $applicantName,
                                $app->application_id,
                                $nextStatusName
                            ));

                            // AUDIT: Log email trigger
                            DB::table('application_logs')->insert([
                                'application_id' => $id,
                                'workflow_step_id' => $stepStepId,
                                'action_by' => $userId,
                                'action' => 'email_triggered',
                                'remarks' => "Action required email queued for authority: {$approverEmail}",
                                'created_at' => now(),
                                'updated_at' => now(),
                            ]);
                        }
                    }
                }

            } else {
                // 6b. Decline — handle based on reason
                $reason = $request->rejection_reason;
                $newStatus = 'declined';
                $requiredAction = 'No further action allowed.';
                $isActive = false;

                if ($reason === 'Invalid ID Card') {
                    $newStatus = 'reupload_required';
                    $requiredAction = 'Please re-upload a valid Institute ID Card or a Bonafide Certificate and resubmit your application.';
                    $isActive = true; // User can still modify
                } elseif ($reason === 'Invalid User') {
                    $newStatus = 'declined';
                    $requiredAction = 'You are not authorized under this role/category. Access denied.';
                    $isActive = false;
                } elseif ($reason === 'User not known to supervisor') {
                    $newStatus = 'supervisor_mapping_issue';
                    $requiredAction = 'Supervisor mapping is missing or unrecognized. Please email the concerned authority to update your reporting structure.';
                    $isActive = true;
                }

                DB::table('applications')->where('id', $id)->update([
                    'status' => $newStatus,
                    'is_active' => $isActive,
                    'current_step_id' => $isActive ? $stepStepId : null, // Reset or keep current step? Let's keep current step for correction.
                    'updated_at' => now(),
                ]);

                // Update the approval record for the current step
                DB::table('application_approvals')
                    ->where('application_id', $id)
                    ->where('workflow_step_id', $stepStepId)
                    ->update([
                        'status' => $newStatus,
                        'approved_by' => $userId,
                        'approved_at' => now(),
                        'remarks' => $request->remarks,
                        'updated_at' => now(),
                    ]);

                User::where('user_id', $appUserId)->update(['status' => $newStatus]);
                $message = "Application declined: {$reason}.";

                // EMAIL: Rejection to User
                $applicantUser = User::where('user_id', $appUserId)->first();
                $applicantProfile = DB::table('user_profiles')->where('user_id', $appUserId)->first();
                $applicantName = $applicantProfile ? ($applicantProfile->first_name . ' ' . $applicantProfile->last_name) : ($applicantUser->email ?? 'Applicant');

                if ($applicantUser && $applicantUser->email) {
                    Mail::to($applicantUser->email)->queue(new ApplicationRejectionMail(
                        $applicantName,
                        $app->application_id,
                        $reason,
                        $requiredAction
                    ));

                    // AUDIT: Log email trigger
                    DB::table('application_logs')->insert([
                        'application_id' => $id,
                        'workflow_step_id' => $stepStepId,
                        'action_by' => $userId,
                        'action' => 'email_triggered',
                        'remarks' => "Decline notice email queued for applicant: {$applicantUser->email}",
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }

            DB::commit();
            return response()->json(['message' => $message]);

        } catch (\Exception $e) {
            DB::rollBack();
            \Illuminate\Support\Facades\Log::error('Workflow Decision Error: ' . $e->getMessage(), [
                'application_id' => $id,
                'user_id' => $userId,
                'trace' => $e->getTraceAsString()
            ]);
            // Determine if it's a structural error (column missing) or logic error
            $errorMessage = 'Decision could not be processed due to a system error.';
            $hint = 'Please check your connection or refresh the page.';

            if (str_contains($e->getMessage(), 'Column not found')) {
                $errorMessage = 'Database configuration error detected.';
                $hint = 'System administrator has been notified. Please try again later.';
            }

            return response()->json([
                'error' => $errorMessage,
                'hint' => $hint,
                'logical_error' => true
            ], 500);
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
            ->whereNotIn('status', ['approved', 'completed', 'declined', 'deactivated'])
            ->get()
            ->map(function ($app) {
                // Get the latest reminder sorted by sent_at
                $latestReminder = $app->reminders->sortByDesc('sent_at')->first();

                return [
                    'id' => $app->id,
                    'application_id' => $app->application_id,
                    'status' => $app->status,
                    'submitted_at' => $app->created_at, // Mapping created_at as submitted_at
                    'latest_reminder' => $latestReminder ? $latestReminder->sent_at : null,
                    'reminder_sent' => $latestReminder ? true : false,
                    'reminders' => $app->reminders,
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



        // Verify if user has permission to approve ID cards (or is a supervisor)
        $hasPermission = DB::table('user_roles as ur')
            ->join('roles as r', 'ur.role_id', '=', 'r.id')
            ->leftJoin('roles_permissions as rp', 'r.id', '=', 'rp.role_id')
            ->leftJoin('permissions as p', 'rp.permission_id', '=', 'p.id')
            ->where('ur.user_id', $userId)
            ->where('ur.is_active', true)
            ->where(function ($q) {
                $q->where('p.slug', 'approve_id_card')
                    ->orWhere('r.slug', 'supervisor');
            })
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
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'ID Card approved successfully.']);
    }

    /**
     * GET /api/auth/tracker/{id?}
     * Unified tracker for both Admins and Users.
     */
    public function unifiedTracker(Request $request, $id = null): JsonResponse
    {
        $userId = $request->auth_user_id;


        $isAdmin = \DB::table('user_roles as ur')
            ->join('roles as r', 'ur.role_id', '=', 'r.id')
            ->where('ur.user_id', $userId)
            ->where('r.slug', 'super_admin')
            ->where('ur.is_active', true)
            ->exists();

        if ($id) {
            // Check if application exists
            $app = \DB::table('applications')->where('id', $id)->first();
            if (!$app)
                return response()->json(['error' => 'Application not found'], 404);

            // If not admin, check ownership
            if (!$isAdmin && $app->user_id !== $userId) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }
            $targetId = $id;
        } else {
            // Get user's most recent application
            $app = \DB::table('applications')
                ->where('user_id', $userId)
                ->orderByDesc('created_at')
                ->first();
            if (!$app)
                return response()->json(null);
            $targetId = $app->id;
        }

        return $this->getTrackerDetails($targetId);
    }

    private function getTrackerDetails($id): JsonResponse
    {
        $app = \DB::table('applications as app')
            ->join('workflows as wf', 'app.workflow_id', '=', 'wf.workflow_id')
            ->join('requests as req', 'app.request_id', '=', 'req.id')
            ->leftJoin('workflow_steps as ws', 'app.current_step_id', '=', 'ws.workflow_step_id')
            ->leftJoin('systems as sys', 'app.assigned_system_id', '=', 'sys.id')
            ->leftJoin('subsystems as subsys', 'app.assigned_subsystem_id', '=', 'subsys.id')
            ->where('app.id', $id)
            ->select([
                'app.id',
                'app.user_id',
                'app.application_id',
                'app.current_step_id',
                'app.status',
                'app.created_at as submitted_at',
                'app.workflow_id',
                'app.ligo_member',
                'app.duration',
                'app.computing_services',
                'wf.workflow_name',
                'req.name as request_name',
                'ws.status_name as current_status',
                'ws.step_no as current_step_no',
                'sys.name as assigned_system_name',
                'subsys.name as assigned_subsystem_name',
            ])
            ->first();

        if (!$app)
            return response()->json(['error' => 'Application not found'], 404);

        $sshKey = \DB::table('ssh_keys')->where('user_id', $app->user_id)->first();
        $userData = \DB::table('users')->where('user_id', $app->user_id)->first();

        $steps = \DB::table('workflow_steps')
            ->where('workflow_id', $app->workflow_id)
            ->orderBy('step_no')
            ->get(['workflow_step_id', 'step_no', 'status_name', 'step_action']);

        $approvals = \DB::table('application_approvals as aa')
            ->join('users as u', 'aa.approved_by', '=', 'u.user_id')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->join('workflow_steps as ws', 'aa.workflow_step_id', '=', 'ws.workflow_step_id')
            ->join('roles as r', 'ws.role_id', '=', 'r.id')
            ->leftJoin('application_logs as al', function ($join) {
                $join->on('aa.application_id', '=', 'al.application_id')
                    ->on('aa.workflow_step_id', '=', 'al.workflow_step_id')
                    ->where('al.action', '=', 'approve');
            })
            ->where('aa.application_id', $id)
            ->where('aa.status', 'approved')
            ->select([
                'aa.workflow_step_id',
                'aa.approved_at',
                'aa.recommended_services',
                'r.name as role_name',
                'al.remarks as comments',
                \DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as approved_by_name")
            ])
            ->get()
            ->keyBy('workflow_step_id');

        $mappedSteps = $steps->map(function ($step) use ($approvals) {
            // Pre-fetch all services and subservices to avoid N+1 queries
            static $svcMap = null;
            static $subMap = null;
            if ($svcMap === null) {
                $svcMap = \DB::table('services')->pluck('name', 'id')->toArray();
                $subMap = \DB::table('subservices')->pluck('name', 'id')->toArray();
            }

            if ($approvals->has($step->workflow_step_id)) {
                $approval = (object) $approvals->get($step->workflow_step_id);
                $step->approved_by_name = $approval->approved_by_name;
                $step->approved_at = $approval->approved_at;
                $step->role_name = $approval->role_name;
                $step->comments = $approval->comments;

                $step->recommended_services = null;
                if ($approval->recommended_services) {
                    $rs = json_decode($approval->recommended_services, true);
                    $names = [];
                    if (!empty($rs['service_ids'])) {
                        foreach ($rs['service_ids'] as $id)
                            if (isset($svcMap[$id]))
                                $names[] = $svcMap[$id];
                    }
                    if (!empty($rs['subservice_ids'])) {
                        foreach ($rs['subservice_ids'] as $id)
                            if (isset($subMap[$id]))
                                $names[] = $subMap[$id];
                    }
                    $step->recommended_services = implode(', ', $names);
                }
            } else {
                $step->approved_by_name = null;
                $step->approved_at = null;
                $step->role_name = null;
                $step->comments = null;
                $step->recommended_services = null;
            }
            return $step;
        });

        return response()->json([
            'application' => $app,
            'steps' => $mappedSteps,
        ]);
    }
}