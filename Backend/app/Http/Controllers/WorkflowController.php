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
use App\Mail\ApplicationIdentityApprovedMail;
use App\Services\UsernameService;
use App\Services\LdapService;
use App\Services\DuplicateApplicantService;
use App\Services\WorkflowLifecycleService;



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
    public function applicantProfile(string $userId, DuplicateApplicantService $duplicateService): JsonResponse
    {
        $profile = DB::table('users as u')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->leftJoin('user_contacts as uc', 'u.user_id', '=', 'uc.user_id')
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

        $data = (array) $profile;
        
        $duplicates = $duplicateService->findDuplicatesByUserId($userId);
        $highestRisk = 'none';
        
        foreach ($duplicates as $dup) {
            if ($dup['risk_level'] === 'high') $highestRisk = 'high';
            else if ($dup['risk_level'] === 'medium' && $highestRisk !== 'high') $highestRisk = 'medium';
            else if ($dup['risk_level'] === 'low' && $highestRisk === 'none') $highestRisk = 'low';
        }

        $data['duplicate_warnings'] = [
            'matches' => $duplicates,
            'risk_score' => ['risk' => $highestRisk, 'reasons' => [], 'similarity' => 0]
        ];

        return response()->json($data);
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

        // Resolve entity-lead and coordinator role IDs for entity-specific routing
        $systemLeadRoleId = DB::table('roles')->where('slug', 'system_lead')->value('id');
        $subsystemLeadRoleId = DB::table('roles')->where('slug', 'subsystem_lead')->value('id');
        $liCoordinatorRoleId = DB::table('roles')->where('slug', 'li_coordinator')->value('id');

        // Role IDs that require targeted (not pool) routing
        $targetedRoleIds = collect(array_filter([$systemLeadRoleId, $subsystemLeadRoleId, $liCoordinatorRoleId]));

        // Split caller's roles into: supervisor role vs targeted roles vs everything else
        $nonSupervisorRoleIds = $filteredRoleIds->filter(
            fn($rid) => $rid !== $supervisorRoleId && !$targetedRoleIds->contains($rid)
        )->values();

        $callerIsSupervisorRole = $supervisorRoleId && $filteredRoleIds->contains($supervisorRoleId);
        $callerIsSystemLeadRole = $systemLeadRoleId && $filteredRoleIds->contains($systemLeadRoleId);
        $callerIsSubsystemLeadRole = $subsystemLeadRoleId && $filteredRoleIds->contains($subsystemLeadRoleId);
        $callerIsLiCoordinatorRole = $liCoordinatorRoleId && $filteredRoleIds->contains($liCoordinatorRoleId);

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
                ->whereNull('app.current_assignee_id') // POOL ONLY
                ->whereNotNull('app.current_step_id')
                ->where('app.is_active', true)
                ->where('app.status', '!=', 'correction_required')
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
                ->whereNull('app.current_assignee_id') // POOL ONLY
                ->whereNotNull('app.current_step_id')
                ->where('app.is_active', true)
                ->where('app.status', '!=', 'correction_required')
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
                ->whereNull('app.current_assignee_id') // POOL ONLY
                ->whereNotNull('app.current_step_id')
                ->where('app.is_active', true)
                ->where('app.status', '!=', 'correction_required')
                // Filter: Caller is the lead of the system assigned to this application
                ->whereRaw('EXISTS (
                    SELECT 1 FROM entity_assignments ea
                    LEFT JOIN subsystems sub ON app.assigned_subsystem_id = sub.id
                    WHERE ea.entity_type = "system" 
                    AND ea.user_id = ? 
                    AND (ea.entity_id = app.assigned_system_id OR ea.entity_id = sub.system_id)
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
                ->whereNull('app.current_assignee_id') // POOL ONLY
                ->whereNotNull('app.current_step_id')
                ->where('app.is_active', true)
                ->where('app.status', '!=', 'correction_required')
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

        // ── Branch E: li_coordinator steps (assigned routing) ───────────────────
        if ($callerIsLiCoordinatorRole && $liCoordinatorRoleId) {
            $liApps = DB::table('applications as app')
                ->join('workflow_steps as ws', 'app.current_step_id', '=', 'ws.workflow_step_id')
                ->join('workflows as wf', 'app.workflow_id', '=', 'wf.workflow_id')
                ->join('requests as req', 'app.request_id', '=', 'req.id')
                ->join('users as u', 'app.user_id', '=', 'u.user_id')
                ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                ->leftJoin('user_affilation as ua', 'app.user_id', '=', 'ua.user_id')
                ->join('roles as r', 'ws.role_id', '=', 'r.id')
                ->where('ws.role_id', $liCoordinatorRoleId)
                ->whereNull('app.current_assignee_id') // POOL ONLY
                ->whereNotNull('app.current_step_id')
                ->where('app.is_active', true)
                ->where('app.status', '!=', 'correction_required')
                // Filter: LI-Coordinator sees applications from their institute (dual routing: applicant vs system)
                ->where(function($q) use ($userId) {
                    // 1. Identity Step: Match by Applicant's Institute
                    $q->where(function($sub) use ($userId) {
                        $sub->where('ws.step_action', 'approve_identity')
                            ->whereRaw('EXISTS (
                                SELECT 1 FROM user_affilation ua
                                JOIN user_affilation app_ua ON app_ua.user_id = app.user_id
                                WHERE ua.user_id = ?
                                AND ua.institute_id = app_ua.institute_id
                            )', [$userId]);
                    })
                    // 2. Technical/Final Step: Match by System's Institute
                    ->orWhere(function($sub) use ($userId) {
                        $sub->where('ws.step_action', '!=', 'approve_identity')
                            ->whereRaw('EXISTS (
                                SELECT 1 FROM user_affilation ua
                                JOIN systems s ON ua.institute_id = s.institute_id
                                LEFT JOIN subsystems sub ON app.assigned_subsystem_id = sub.id
                                WHERE ua.user_id = ?
                                AND (s.id = app.assigned_system_id OR s.id = sub.system_id)
                            )', [$userId]);
                    })
                    // 3. Fallback: Default Coordinator sees everything in the pool
                    ->orWhereRaw('EXISTS (
                        SELECT 1 FROM user_roles ur
                        JOIN roles r ON ur.role_id = r.id
                        WHERE ur.user_id = ?
                        AND r.slug = "li_coordinator"
                        AND ur.is_default = 1
                    )', [$userId]);
                })
                ->select($cols)
                ->orderBy('app.created_at', 'asc')
                ->get();

            $apps = $apps->merge($liApps);
        }

        // ── Branch F: Direct Assignment Routing ───────────────────────────────
        $assignedApps = DB::table('applications as app')
            ->join('workflow_steps as ws', 'app.current_step_id', '=', 'ws.workflow_step_id')
            ->join('workflows as wf', 'app.workflow_id', '=', 'wf.workflow_id')
            ->join('requests as req', 'app.request_id', '=', 'req.id')
            ->join('users as u', 'app.user_id', '=', 'u.user_id')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->leftJoin('user_affilation as ua', 'app.user_id', '=', 'ua.user_id')
            ->join('roles as r', 'ws.role_id', '=', 'r.id')
            ->where('app.current_assignee_id', $userId) // DIRECTLY ASSIGNED TO CALLER
            ->whereNotNull('app.current_step_id')
            ->where('app.is_active', true)
            ->where('app.status', '!=', 'correction_required')
            ->select($cols)
            ->get();
        
        $apps = $apps->merge($assignedApps);

        $apps = $apps->unique('id')->values();

        // ── Attach previous recommendations ──
        foreach ($apps as $app) {
            // Fetch formal approvals for ALL applications of this user
            $pastApprovals = DB::table('application_approvals as aa')
                ->join('applications as past_app', 'aa.application_id', '=', 'past_app.id')
                ->join('users as u', 'aa.approved_by', '=', 'u.user_id')
                ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                ->join('workflow_steps as ws', 'aa.workflow_step_id', '=', 'ws.workflow_step_id')
                ->join('roles as r', 'ws.role_id', '=', 'r.id')
                ->where(function($q) use ($app) {
                    $q->where('aa.application_id', $app->id);
                    if (isset($app->parent_application_id) && $app->parent_application_id) {
                        $q->orWhere('aa.application_id', $app->parent_application_id);
                    }
                })
                ->whereNotNull('aa.approved_by')
                ->select([
                    'aa.recommended_services',
                    'aa.remarks',
                    'aa.duration',
                    DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as reviewer_name"),
                    'r.name as reviewer_role',
                    'ws.step_action',
                    'aa.approved_at as action_date',
                    DB::raw("'approval' as record_type")
                ])
                ->get();

            // Fetch corrections/rejections from logs for ALL applications of this user
            $pastLogs = DB::table('application_logs as al')
                ->join('applications as past_app', 'al.application_id', '=', 'past_app.id')
                ->join('users as u', 'al.action_by', '=', 'u.user_id')
                ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                ->leftJoin('user_roles as ur', function($join) {
                    $join->on('u.user_id', '=', 'ur.user_id')->where('ur.is_active', true);
                })
                ->leftJoin('roles as r', 'ur.role_id', '=', 'r.id')
                ->where(function($q) use ($app) {
                    $q->where('al.application_id', $app->id);
                    if (isset($app->parent_application_id) && $app->parent_application_id) {
                        $q->orWhere('al.application_id', $app->parent_application_id);
                    }
                })
                ->whereIn('al.action', ['Returned for Correction', 'Final Rejection', 'Rejected'])
                ->select([
                    DB::raw("NULL as recommended_services"),
                    'al.remarks',
                    DB::raw("NULL as duration"),
                    DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as reviewer_name"),
                    'r.name as reviewer_role',
                    'al.action as step_action',
                    'al.created_at as action_date',
                    DB::raw("'log' as record_type")
                ])
                ->get();

            $history = $pastApprovals->concat($pastLogs)->sortBy('action_date');

            $pastReviewers = [];
            foreach ($history as $h) {
                $ps = $h->recommended_services ? json_decode($h->recommended_services, true) : [];
                $pastReviewers[] = [
                    'name' => $h->reviewer_name,
                    'role' => $h->reviewer_role,
                    'action' => $h->step_action,
                    'date' => $h->action_date,
                    'remarks' => $h->remarks ?? null,
                    'duration' => $h->duration ?? null,
                    'service_ids' => $ps['service_ids'] ?? [],
                    'subservice_ids' => $ps['subservice_ids'] ?? []
                ];
            }

            $recommendedSvcs = [];
            $recommendedSubs = [];
            $recommendedDur = null;

            // Iterate through history in reverse to find most recent technical recommendations
            foreach (collect($pastReviewers)->reverse() as $r) {
                if (!in_array($r['action'], ['Returned for Correction', 'Final Rejection', 'Rejected'])) {
                    if (empty($recommendedSvcs) && !empty($r['service_ids'])) {
                        $recommendedSvcs = $r['service_ids'];
                    }
                    if (empty($recommendedSubs) && !empty($r['subservice_ids'])) {
                        $recommendedSubs = $r['subservice_ids'];
                    }
                    if (empty($recommendedDur) && !empty($r['duration'])) {
                        $recommendedDur = $r['duration'];
                    }
                }
            }

            $app->recommended_service_ids = $recommendedSvcs;
            $app->recommended_subservice_ids = $recommendedSubs;
            $app->recommended_duration = $recommendedDur;

            if (!empty($recommendedSvcs)) {
                \Log::info("Found recommendations for App {$app->id}:", [
                    'services' => $recommendedSvcs,
                    'duration' => $recommendedDur
                ]);
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
        return $this->unifiedTracker($request);
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
    public function decide(Request $request, int $id, UsernameService $usernameService, LdapService $ldapService, WorkflowLifecycleService $lifecycleService): JsonResponse
    {
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
        $step = DB::table('workflow_steps as ws')
            ->join('roles as r', 'ws.role_id', '=', 'r.id')
            ->where('ws.workflow_step_id', $currentStepId)
            ->select('ws.*', 'r.slug as role_slug')
            ->first();

        if (!$step) {
            return response()->json(['error' => 'Workflow step not found.'], 404);
        }

        // 3. Conditional Validation
        $isIdentityStep = str_contains(strtolower($step->step_action ?? ''), 'identity');
        $isFinalReject = in_array($action, ['decline', 'final_rejection']);
        $isApproval = in_array($action, ['approve', 'recommend']);

        $rules = [
            'action' => 'required|in:approve,recommend,decline,send_back_for_id,final_rejection',
            'remarks' => 'nullable|string|max:1000',
        ];

        if ($isFinalReject) {
            $rules['rejection_reason'] = 'required|string|in:Invalid Institutional Affiliation,Duplicate Application,Incomplete/Invalid Documents';
        }

        if ($isApproval && !$isIdentityStep) {
            $rules['subsystem_id'] = 'required|exists:subsystems,id';
            $rules['ligo_member'] = 'required|in:yes,no';
            $rules['service_ids'] = 'required|array|min:1';
        }

        $validator = \Validator::make($request->all(), $rules);
        if ($validator->fails()) {
            return response()->json(['error' => $validator->errors()->first(), 'details' => $validator->errors()], 422);
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
        $roleSlug = $step->role_slug;

        // 3. Resolve role IDs for entity-specific steps
        $supervisorRoleId = DB::table('roles')->where('slug', self::SUPERVISOR_ROLE_SLUG)->value('id');
        $systemLeadRoleId = DB::table('roles')->where('slug', 'system_lead')->value('id');
        $subsystemLeadRoleId = DB::table('roles')->where('slug', 'subsystem_lead')->value('id');
        $liCoordinatorRoleId = DB::table('roles')->where('slug', 'li_coordinator')->value('id');

        $isLiCoordinatorStep = ($liCoordinatorRoleId && $stepRoleId == $liCoordinatorRoleId);
        $isPersonalSupervisorStep = ($supervisorRoleId && $stepRoleId == $supervisorRoleId);
        $isSystemLeadStep = ($systemLeadRoleId && $stepRoleId == $systemLeadRoleId);
        $isSubsystemLeadStep = ($subsystemLeadRoleId && $stepRoleId == $subsystemLeadRoleId);

        // 4. Authorization check
        if ($isPersonalSupervisorStep) {
            // Check if ID card is approved before supervisor can recommend (unless this is the identity step itself)
            if (!$isIdentityStep && $action === 'approve' && !empty($app->id_card_path) && is_null($app->id_card_approved_by)) {
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
            $assignedSystemId = $app->assigned_system_id ?? $request->system_id ?? null;
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
            $assignedSubsystemId = $app->assigned_subsystem_id ?? $request->subsystem_id ?? null;
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

        } elseif ($isLiCoordinatorStep) {
            // For li_coordinator steps: apply institute-based logic
            $actorAffiliation = DB::table('user_affilation')->where('user_id', $userId)->first();
            if (!$actorAffiliation) {
                return response()->json(['error' => 'Your institutional affiliation is not configured.'], 403);
            }

            if ($isIdentityStep) {
                // Identity Step: Check applicant's institute
                $applicantAffiliation = DB::table('user_affilation')->where('user_id', $appUserId)->first();
                if ($applicantAffiliation) {
                    $targetInstituteId = $applicantAffiliation->institute_id;
                    if ($actorAffiliation->institute_id != $targetInstituteId) {
                        // Check if target institute has any active LI-Coordinator
                        $hasLocalCoordinator = DB::table('user_roles as ur')
                            ->join('roles as r', 'ur.role_id', '=', 'r.id')
                            ->join('user_affilation as ua', 'ur.user_id', '=', 'ua.user_id')
                            ->where('r.slug', 'li_coordinator')
                            ->where('ua.institute_id', $targetInstituteId)
                            ->where('ur.is_active', true)
                            ->exists();

                        if ($hasLocalCoordinator) {
                            return response()->json(['error' => 'You are not the LI-Coordinator for this applicant\'s institute.'], 403);
                        } else {
                            // Fallback to IUCAA (Institute ID 1)
                            if ($actorAffiliation->institute_id != 1) {
                                return response()->json(['error' => 'This institute has no LI-Coordinator. Only an IUCAA LI-Coordinator can approve this.'], 403);
                            }
                        }
                    }
                }
            } else {
                // Service Step: Check subsystem -> system -> institute
                $assignedSubsystemId = $app->assigned_subsystem_id ?? $request->subsystem_id ?? null;
                if ($assignedSubsystemId) {
                    $systemInstituteId = DB::table('subsystems as sub')
                        ->join('systems as s', 'sub.system_id', '=', 's.id')
                        ->where('sub.id', $assignedSubsystemId)
                        ->value('s.institute_id');
                    
                    if ($systemInstituteId && $actorAffiliation->institute_id != $systemInstituteId) {
                         return response()->json(['error' => 'You are not the LI-Coordinator for the institute that owns this system.'], 403);
                    }
                }
            }

            $hasRole = DB::table('user_roles')
                ->where('user_id', $userId)->where('role_id', $liCoordinatorRoleId)->where('is_active', true)->exists();
            if (!$hasRole) {
                return response()->json(['error' => 'You are not authorised to act on this application.'], 403);
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
        // Fetch role ID for final duration update logic
        $liCoordinatorRoleId = DB::table('roles')->where('slug', 'li_coordinator')->value('id');
        $isLiCoordinator = ($liCoordinatorRoleId && $stepRoleId == $liCoordinatorRoleId);
        
        if ($request->filled('duration') && $this->hasApplicationColumn('duration')) {
            // User requested: only update main applications table if LI-Coordinator is approving
            if ($isLiCoordinator && $action === 'approve') {
                $appUpdates['duration'] = $request->duration;
            }
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

            if ($action === 'approve' || $action === 'recommend') {
                $services = null;
                if ($request->has('service_ids') || $request->has('subservice_ids')) {
                    $services = json_encode([
                        'service_ids' => $request->service_ids ?? [],
                        'subservice_ids' => $request->subservice_ids ?? []
                    ]);
                }

                $result = $lifecycleService->moveToNextStep($id, $userId, $request->assigned_to, $request->remarks, $services, $request->duration);
                
                if ($result['status'] === 'final_approved') {
                    // Mark as provisioning pending if it was the last step
                    DB::table('applications')->where('id', $id)->update([
                        'status' => 'provisioning_pending',
                        'approved_by' => $userId,
                        'approved_at' => now(),
                    ]);
                    $message = 'Application fully approved. Moving to account provisioning queue.';
                } else {
                    $message = 'Application moved to ' . ($result['next_step'] ?? 'next stage');
                }

                DB::commit();
                return response()->json(['message' => $message]);
            } elseif ($action === 'send_back_for_id') {
                $lifecycleService->sendBackForIdCard($id, $request->remarks ?? 'please upload a valid ID card else your application will be declined', $userId);
                $message = "Application sent back for valid ID card upload.";
            } elseif ($action === 'final_rejection' || $action === 'decline') {
                $lifecycleService->finalReject($id, $request->remarks ?? $request->rejection_reason, $userId);
                $message = "Application Declined.";
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

        // ── LI-Coordinator Institute Check ──
        $liCoordinatorRoleId = DB::table('roles')->where('slug', 'li_coordinator')->value('id');
        $isLiCoordinator = DB::table('user_roles')
            ->where('user_id', $userId)
            ->where('role_id', $liCoordinatorRoleId)
            ->where('is_active', true)
            ->exists();

        if ($isLiCoordinator) {
            // Check if Super Admin bypass
            $isSuperAdmin = DB::table('user_roles as ur')
                ->join('roles as r', 'ur.role_id', '=', 'r.id')
                ->where('ur.user_id', $userId)
                ->where('r.slug', 'super_admin')
                ->where('ur.is_active', true)
                ->exists();

            if (!$isSuperAdmin) {
                $actorAffiliation = DB::table('user_affilation')->where('user_id', $userId)->first();
                $applicantAffiliation = DB::table('user_affilation')->where('user_id', $app->user_id)->first();

                if ($actorAffiliation && $applicantAffiliation) {
                    $targetInstituteId = $applicantAffiliation->institute_id;
                    if ($actorAffiliation->institute_id != $targetInstituteId) {
                        // Check if target institute has any active LI-Coordinator
                        $hasLocalCoordinator = DB::table('user_roles as ur')
                            ->join('roles as r', 'ur.role_id', '=', 'r.id')
                            ->join('user_affilation as ua', 'ur.user_id', '=', 'ua.user_id')
                            ->where('r.slug', 'li_coordinator')
                            ->where('ua.institute_id', $targetInstituteId)
                            ->where('ur.is_active', true)
                            ->exists();

                        if ($hasLocalCoordinator) {
                            return response()->json(['error' => 'You are not the LI-Coordinator for this applicant\'s institute.'], 403);
                        } else {
                            // Fallback to IUCAA (ID 1)
                            if ($actorAffiliation->institute_id != 1) {
                                return response()->json(['error' => 'This institute has no LI-Coordinator. Only an IUCAA LI-Coordinator can approve this.'], 403);
                            }
                        }
                    }
                }
            }
        }

        DB::table('applications')->where('id', $id)->update([
            'id_card_approved_by' => $userId,
            'id_card_approved_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('application_logs')->insert([
            'application_id' => $id,
            'workflow_step_id' => $app->current_step_id,
            'action' => 'Identity Approved',
            'remarks' => $request->remarks ?? 'Identity card verified and approved.',
            'action_by' => $userId,
            'created_at' => now(),
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


        $isReviewer = \DB::table('user_roles as ur')
            ->join('roles as r', 'ur.role_id', '=', 'r.id')
            ->where('ur.user_id', $userId)
            ->whereIn('r.slug', ['super_admin', 'li_coordinator', 'supervisor', 'system_lead', 'subsystem_lead', 'coordinator'])
            ->where('ur.is_active', true)
            ->exists();

        if ($id) {
            // Check if application exists
            $app = \DB::table('applications')->where('id', $id)->first();
            if (!$app)
                return response()->json(['error' => 'Application not found'], 404);

            // If not reviewer, check ownership
            if (!$isReviewer && $app->user_id !== $userId) {
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
            ->leftJoin('users as ureq', 'app.correction_requested_by', '=', 'ureq.user_id')
            ->leftJoin('user_profiles as upreq', 'ureq.user_id', '=', 'upreq.user_id')
            ->leftJoin('users as uapp', 'app.user_id', '=', 'uapp.user_id')
            ->leftJoin('user_profiles as upapp', 'uapp.user_id', '=', 'upapp.user_id')
            ->leftJoin('users as urej', 'app.rejected_by', '=', 'urej.user_id')
            ->leftJoin('user_profiles as uprej', 'urej.user_id', '=', 'uprej.user_id')
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
                'app.correction_required',
                'app.correction_requested_at',
                'app.paused_workflow_step',
                'app.id_card_path',
                'app.id_card_reupload_remarks',
                'app.rejection_reason',
                'app.rejected_at',
                \DB::raw("COALESCE(CONCAT(upreq.first_name, ' ', upreq.last_name), ureq.email) as correction_requested_by_name"),
                \DB::raw("COALESCE(CONCAT(upapp.first_name, ' ', upapp.last_name), uapp.email) as applicant_name"),
                \DB::raw("COALESCE(CONCAT(uprej.first_name, ' ', uprej.last_name), urej.email) as rejected_by_name"),
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

        // Calculate a reliable computing_services flag by scanning all approval steps
        $hasComputingInApprovals = false;
        $allApprovals = \DB::table('application_approvals')
            ->where('application_id', $app->id)
            ->whereNotNull('recommended_services')
            ->get();

        foreach ($allApprovals as $appr) {
            $rs = json_decode($appr->recommended_services, true);
            if (!empty($rs['service_ids'])) {
                $exists = \DB::table('services')
                    ->whereIn('id', $rs['service_ids'])
                    ->where('is_computing', true)
                    ->exists();
                if ($exists) {
                    $hasComputingInApprovals = true;
                    break;
                }
            }
        }
        $app->computing_services = $app->computing_services || $hasComputingInApprovals;

        // Standardize timestamps for frontend
        $app->submitted_at = $app->submitted_at ? \Carbon\Carbon::parse($app->submitted_at)->toIso8601String() : null;
        $app->correction_requested_at = $app->correction_requested_at ? \Carbon\Carbon::parse($app->correction_requested_at)->toIso8601String() : null;
        $app->rejected_at = $app->rejected_at ? \Carbon\Carbon::parse($app->rejected_at)->toIso8601String() : null;

        $sshKey = \DB::table('ssh_keys')->where('user_id', $app->user_id)->first();
        $userData = \DB::table('users')->where('user_id', $app->user_id)->first();

        $steps = \DB::table('workflow_steps as ws')
            ->join('roles as r', 'ws.role_id', '=', 'r.id')
            ->where('ws.workflow_id', $app->workflow_id)
            ->orderBy('ws.step_no')
            ->get([
                'ws.workflow_step_id',
                'ws.step_no',
                'ws.status_name',
                'ws.step_action',
                'r.name as role_name'
            ]);

        $approvals = \DB::table('application_approvals as aa')
            ->leftJoin('users as u', 'aa.approved_by', '=', 'u.user_id')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->join('workflow_steps as ws', 'aa.workflow_step_id', '=', 'ws.workflow_step_id')
            ->leftJoin('roles as r', 'ws.role_id', '=', 'r.id')
            ->where('aa.application_id', $id)
            ->whereIn('aa.status', ['approved', 'rejected', 'declined'])
            ->select([
                'aa.workflow_step_id',
                'aa.status',
                'aa.approved_at',
                'aa.remarks',
                'aa.recommended_services',
                'r.name as role_name',
                'u.email as approver_email',
                \DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as approved_by_name")
            ])
            ->get()
            ->keyBy('workflow_step_id');

        // Fetch all logs to get remarks/comments even for pending steps
        $logs = \DB::table('application_logs as al')
            ->join('users as u', 'al.action_by', '=', 'u.user_id')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->where('al.application_id', $id)
            ->select([
                'al.workflow_step_id',
                'al.remarks',
                'al.action',
                \DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as actor_name")
            ])
            ->orderBy('al.created_at', 'desc')
            ->get()
            ->groupBy('workflow_step_id');

        $mappedSteps = $steps->map(function ($step) use ($approvals, $logs, $app) {
            // Pre-fetch all services and subservices to avoid N+1 queries
            static $svcMap = null;
            static $subMap = null;
            if ($svcMap === null) {
                $svcMap = \DB::table('services')->pluck('name', 'id')->toArray();
                $subMap = \DB::table('subservices')->pluck('name', 'id')->toArray();
            }

            $stepLogs = $logs->get($step->workflow_step_id);
            $latestLog = $stepLogs ? $stepLogs->first() : null;

            if ($approvals->has($step->workflow_step_id)) {
                $approval = (object) $approvals->get($step->workflow_step_id);
                $step->status = $approval->status;
                
                if ($step->status === 'approved') {
                    if ($step->step_action === 'approve_identity') {
                        $step->status_name = "Identity Approved by " . ($step->role_name ?? 'Reviewer');
                    } else {
                        $step->status_name = "Approved by " . ($step->role_name ?? 'Reviewer');
                    }
                } elseif ($step->status === 'rejected' || $step->status === 'declined') {
                    $step->status_name = "Declined by " . ($step->role_name ?? 'Reviewer');
                }

                $step->approved_by_name = $approval->approved_by_name;
                $step->approver_email = $approval->approver_email;
                $step->approved_at = $approval->approved_at ? \Carbon\Carbon::parse($approval->approved_at)->toIso8601String() : null;
                $step->comments = $latestLog ? $latestLog->remarks : ($approval->remarks ?? null);
                $step->remarks = $step->comments;

                $step->recommended_services = null;
                if ($approval->recommended_services) {
                    $rs = json_decode($approval->recommended_services, true);
                    $names = [];
                    if (!empty($rs['service_ids'])) {
                        foreach ($rs['service_ids'] as $sid) if (isset($svcMap[$sid])) $names[] = $svcMap[$sid];
                    }
                    if (!empty($rs['subservice_ids'])) {
                        foreach ($rs['subservice_ids'] as $sid) if (isset($subMap[$sid])) $names[] = $subMap[$sid];
                    }
                    $step->recommended_services = implode(', ', $names);
                }
            } else {
                $step->status = 'pending';
                
                // If the entire application is already rejected/declined, other pending steps should reflect that
                if ($app && in_array($app->status, ['rejected', 'declined', 'final_rejection'])) {
                    if ($app->current_step_id == $step->workflow_step_id) {
                        $step->status = 'declined';
                        $step->status_name = "Declined by " . ($step->role_name ?? 'Reviewer');
                        $step->approved_at = $app->rejected_at ? date('Y-m-d\TH:i:s\Z', strtotime($app->rejected_at)) : null;
                        $step->approved_by_name = $app->rejected_by_name;
                        $step->remarks = $app->rejection_reason;
                    } else {
                        $step->status = 'pending';
                    }
                }

                // If this is the step where workflow is paused for ID re-upload
                if ($app && isset($app->status) && $app->status === 'id_card_reupload_required' && isset($app->paused_workflow_step) && $app->paused_workflow_step == $step->workflow_step_id) {
                    $step->status_name = "Awaiting ID Card Re-upload";
                    $step->status = 'correction';
                }

                $step->approved_by_name = $latestLog ? $latestLog->actor_name : null;
                $step->approved_at = null;
                $step->comments = $latestLog ? $latestLog->remarks : null;
                $step->remarks = $step->comments;
                $step->recommended_services = null;
            }
            return $step;
        });

        $history = \DB::table('applications as app')
            ->join('workflows as wf', 'app.workflow_id', '=', 'wf.workflow_id')
            ->join('requests as req', 'app.request_id', '=', 'req.id')
            ->leftJoin('users as urej', 'app.rejected_by', '=', 'urej.user_id')
            ->leftJoin('user_profiles as uprej', 'urej.user_id', '=', 'uprej.user_id')
            ->where('app.user_id', $app->user_id)
            ->orderByDesc('app.created_at')
            ->select([
                'app.id',
                'app.application_id',
                'app.status',
                'app.created_at as submitted_at',
                'app.updated_at',
                'app.reapplied_from',
                'app.parent_application_id',
                'app.declined_reason',
                'app.rejection_reason',
                'wf.workflow_name',
                'req.name as request_name',
                \DB::raw("COALESCE(CONCAT(uprej.first_name, ' ', uprej.last_name), urej.email) as rejected_by_name"),
            ])
            ->get()
            ->map(function ($hApp) {
                $hApp->submitted_at = $hApp->submitted_at ? \Carbon\Carbon::parse($hApp->submitted_at)->toIso8601String() : null;
                $hApp->updated_at = $hApp->updated_at ? \Carbon\Carbon::parse($hApp->updated_at)->toIso8601String() : null;
                return $hApp;
            });

        return response()->json([
            'application' => $app,
            'steps' => $mappedSteps,
            'ssh_key' => $sshKey,
            'history' => $history,
        ]);
    }

    /**
     * GET /api/auth/review/staff/subsystem/{subsystemId}
     *
     * Returns users with 'subsystem_lead' role assigned to a specific subsystem.
     */
    public function staffBySubsystem(int $subsystemId): JsonResponse
    {
        $staff = DB::table('users as u')
            ->join('entity_assignments as ea', 'u.user_id', '=', 'ea.user_id')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->where('ea.entity_type', 'subsystem')
            ->where('ea.entity_id', $subsystemId)
            ->where('ea.is_active', true)
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
     * POST /api/auth/application/resubmit-identity
     */
    public function resubmitIdentity(Request $request): JsonResponse
    {
        $request->validate([
            'application_id' => 'required|exists:applications,id',
            'identity_proof' => 'required|file|mimes:jpeg,png,jpg,pdf|max:5120',
        ]);

        $app = DB::table('applications')->where('id', $request->application_id)->first();
        if (!$app || $app->user_id != auth()->id()) {
            return response()->json(['error' => 'Application not found or access denied.'], 403);
        }

        if ($app->status !== 'id_card_reupload_required' && $app->status !== 'correction_required') {
            return response()->json(['error' => 'Application is not in a correction state.'], 400);
        }

        try {
            $file = $request->file('identity_proof');
            $fileName = 'id_' . $app->user_id . '_' . time() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('identity_proofs', $fileName, 'public');

            DB::transaction(function () use ($app, $path) {
                // Update user_affilation
                DB::table('user_affilation')
                    ->where('user_id', $app->user_id)
                    ->update(['id_card_path' => $path, 'updated_at' => now()]);

                // Record in user_identities
                DB::table('user_identities')->insert([
                    'user_id' => $app->user_id,
                    'file_path' => $path,
                    'status' => 'active',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

                // Update application status and resume workflow
                DB::table('applications')
                    ->where('id', $app->id)
                    ->update([
                        'status' => 'pending', // Resume to pending review
                        'id_card_path' => $path, // Sync path
                        'current_step_id' => $app->paused_workflow_step ?? $app->current_step_id, // Resume at paused step
                        'id_card_approved_by' => null, // Reset approval for new card
                        'id_card_approved_at' => null,
                        'updated_at' => now()
                    ]);

                // Log action
                DB::table('application_logs')->insert([
                    'application_id' => $app->id,
                    'workflow_step_id' => $app->paused_workflow_step ?? $app->current_step_id,
                    'action' => 'Identity Proof Resubmitted',
                    'remarks' => 'Applicant re-uploaded identity proof. Workflow resumed at previous stage.',
                    'action_by' => $app->user_id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });

            return response()->json(['message' => 'Identity proof resubmitted successfully. Application is back under review.']);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to process resubmission: ' . $e->getMessage()], 500);
        }
    }
}
