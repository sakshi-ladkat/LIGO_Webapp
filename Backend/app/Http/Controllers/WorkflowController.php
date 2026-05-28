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
            ->leftJoin('countries as c', 'uc.country_id', '=', 'c.id')
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
                'c.name as country_name',
                'uc.city',
                'uc.phone_number',
                'i.name as institute_name',
                'ua.other_institute',
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
            if ($dup['risk_level'] === 'high')
                $highestRisk = 'high';
            else if ($dup['risk_level'] === 'medium' && $highestRisk !== 'high')
                $highestRisk = 'medium';
            else if ($dup['risk_level'] === 'low' && $highestRisk === 'none')
                $highestRisk = 'low';
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

        // Resolve special role IDs in one query.
        // NOTE: These roles are created via admin after deployment — not guaranteed to exist
        // in all environments. ?? null ensures safe fallback; branches are skipped if null
        // because collect()->contains(null) always returns false.
        $specialRoles = DB::table('roles')
            ->whereIn('slug', ['supervisor', 'system_lead', 'subsystem_lead', 'li_coordinator'])
            ->pluck('id', 'slug');

        $supervisorRoleId    = $specialRoles['supervisor']     ?? null;
        $systemLeadRoleId    = $specialRoles['system_lead']    ?? null;
        $subsystemLeadRoleId = $specialRoles['subsystem_lead'] ?? null;
        $liCoordinatorRoleId = $specialRoles['li_coordinator'] ?? null;

        // Role IDs that require targeted (entity-specific) routing rather than pool routing.
        // array_filter removes any nulls in case roles haven't been created by the admin yet.
        $targetedRoleIds = collect(array_filter([$systemLeadRoleId, $subsystemLeadRoleId, $liCoordinatorRoleId]));

        // Split caller's roles into: supervisor vs targeted-entity vs generic pool
        $nonSupervisorRoleIds = $filteredRoleIds->filter(
            fn($rid) => $rid !== $supervisorRoleId && !$targetedRoleIds->contains($rid)
        )->values();

        // Check if the caller holds each special role.
        // If a role ID is null (role not created by admin yet), contains(null) = false,
        // so the corresponding branch is safely skipped — no double-guard needed.
        $callerIsSupervisorRole    = $filteredRoleIds->contains($supervisorRoleId);
        $callerIsSystemLeadRole    = $filteredRoleIds->contains($systemLeadRoleId);
        $callerIsSubsystemLeadRole = $filteredRoleIds->contains($subsystemLeadRoleId);
        $callerIsLiCoordinatorRole = $filteredRoleIds->contains($liCoordinatorRoleId);

        // ── Build the base select columns shared by all branches ─────────────
        // NOTE: ica_u / ica_up / ica_r must be joined in each branch to resolve
        // id_card_approved_by details without correlated scalar subqueries.
        $cols = [
            'app.id',
            'app.application_id',
            'app.parent_application_id',
            'app.reapplied_from',
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
            // Resolved via explicit JOINs (ica_u, ica_up, ica_r) in each branch
            DB::raw("COALESCE(CONCAT(ica_up.first_name, ' ', ica_up.last_name), ica_u.email) as id_card_approved_by_name"),
            DB::raw("ica_r.name as id_card_approved_by_role"),
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
                ->join('roles as r', 'ws.role_id', '=', 'r.id')
                // Resolve id_card_approved_by via JOINs instead of correlated subqueries
                ->leftJoin('users as ica_u', 'app.id_card_approved_by', '=', 'ica_u.user_id')
                ->leftJoin('user_profiles as ica_up', 'ica_u.user_id', '=', 'ica_up.user_id')
                ->leftJoin('user_roles as ica_ur', function ($join) {
                    $join->on('ica_u.user_id', '=', 'ica_ur.user_id')->where('ica_ur.is_active', true);
                })
                ->leftJoin('roles as ica_r', 'ica_ur.role_id', '=', 'ica_r.id');

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
                ->leftJoin('users as ica_u', 'app.id_card_approved_by', '=', 'ica_u.user_id')
                ->leftJoin('user_profiles as ica_up', 'ica_u.user_id', '=', 'ica_up.user_id')
                ->leftJoin('user_roles as ica_ur', function ($join) {
                    $join->on('ica_u.user_id', '=', 'ica_ur.user_id')->where('ica_ur.is_active', true);
                })
                ->leftJoin('roles as ica_r', 'ica_ur.role_id', '=', 'ica_r.id')
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
                ->leftJoin('users as ica_u', 'app.id_card_approved_by', '=', 'ica_u.user_id')
                ->leftJoin('user_profiles as ica_up', 'ica_u.user_id', '=', 'ica_up.user_id')
                ->leftJoin('user_roles as ica_ur', function ($join) {
                    $join->on('ica_u.user_id', '=', 'ica_ur.user_id')->where('ica_ur.is_active', true);
                })
                ->leftJoin('roles as ica_r', 'ica_ur.role_id', '=', 'ica_r.id')
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
                ->leftJoin('users as ica_u', 'app.id_card_approved_by', '=', 'ica_u.user_id')
                ->leftJoin('user_profiles as ica_up', 'ica_u.user_id', '=', 'ica_up.user_id')
                ->leftJoin('user_roles as ica_ur', function ($join) {
                    $join->on('ica_u.user_id', '=', 'ica_ur.user_id')->where('ica_ur.is_active', true);
                })
                ->leftJoin('roles as ica_r', 'ica_ur.role_id', '=', 'ica_r.id')
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
                ->leftJoin('users as ica_u', 'app.id_card_approved_by', '=', 'ica_u.user_id')
                ->leftJoin('user_profiles as ica_up', 'ica_u.user_id', '=', 'ica_up.user_id')
                ->leftJoin('user_roles as ica_ur', function ($join) {
                    $join->on('ica_u.user_id', '=', 'ica_ur.user_id')->where('ica_ur.is_active', true);
                })
                ->leftJoin('roles as ica_r', 'ica_ur.role_id', '=', 'ica_r.id')
                ->where('ws.role_id', $liCoordinatorRoleId)
                ->whereNull('app.current_assignee_id') // POOL ONLY
                ->whereNotNull('app.current_step_id')
                ->where('app.is_active', true)
                ->where('app.status', '!=', 'correction_required')
                // Filter: LI-Coordinator sees applications from their institute (dual routing: applicant vs system)
                ->where(function ($q) use ($userId) {
                    // 1. Identity Step: Match by Applicant's Institute
                    $q->where(function ($sub) use ($userId) {
                        $sub->where('ws.step_action', 'approve_identity')
                            ->whereRaw('EXISTS (
                                SELECT 1 FROM user_affilation ua
                                JOIN user_affilation app_ua ON app_ua.user_id = app.user_id
                                WHERE ua.user_id = ?
                                AND ua.institute_id = app_ua.institute_id
                            )', [$userId]);
                    })
                        // 2. Technical/Final Step: Match by System's Institute
                        ->orWhere(function ($sub) use ($userId) {
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
            ->leftJoin('users as ica_u', 'app.id_card_approved_by', '=', 'ica_u.user_id')
            ->leftJoin('user_profiles as ica_up', 'ica_u.user_id', '=', 'ica_up.user_id')
            ->leftJoin('user_roles as ica_ur', function ($join) {
                $join->on('ica_u.user_id', '=', 'ica_ur.user_id')->where('ica_ur.is_active', true);
            })
            ->leftJoin('roles as ica_r', 'ica_ur.role_id', '=', 'ica_r.id')
            ->where('app.current_assignee_id', $userId) // DIRECTLY ASSIGNED TO CALLER
            ->whereNotNull('app.current_step_id')
            ->where('app.is_active', true)
            ->where('app.status', '!=', 'correction_required')
            ->select($cols)
            ->get();

        $apps = $apps->merge($assignedApps);

        $apps = $apps->unique('id')->values();

        // ── Pre-fetch history for ALL applications to prevent N+1 queries ──
        $allAppIds = [];
        foreach ($apps as $app) {
            $allAppIds[] = $app->id;
            if (!empty($app->parent_application_id)) {
                $allAppIds[] = $app->parent_application_id;
            }
        }
        $allAppIds = array_unique($allAppIds);

        $approvalsByApp = [];
        $logsByApp = [];

        if (!empty($allAppIds)) {
            $pastApprovals = DB::table('application_approvals as aa')
                ->join('users as u', 'aa.approved_by', '=', 'u.user_id')
                ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                ->join('workflow_steps as ws', 'aa.workflow_step_id', '=', 'ws.workflow_step_id')
                ->join('roles as r', 'ws.role_id', '=', 'r.id')
                ->whereIn('aa.application_id', $allAppIds)
                ->where('aa.status', '!=', 'declined')
                ->whereNotNull('aa.approved_by')
                ->select([
                    'aa.id as approval_id',
                    'aa.application_id',
                    'aa.remarks',
                    'aa.duration',
                    DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as reviewer_name"),
                    'r.name as reviewer_role',
                    'ws.step_action',
                    'aa.approved_at as action_date',
                    DB::raw("'approval' as record_type")
                ])
                ->get();

            $approvalIds = $pastApprovals->pluck('approval_id')->toArray();

            // Fetch 3NF services and subservices mapped to these approvals
            $approvalServices = DB::table('approval_services')
                ->whereIn('approval_id', $approvalIds)
                ->get(['approval_id', 'service_id'])
                ->groupBy('approval_id')
                ->map(fn($g) => $g->pluck('service_id')->toArray());

            $approvalSubservices = DB::table('approval_subservices')
                ->whereIn('approval_id', $approvalIds)
                ->get(['approval_id', 'subservice_id'])
                ->groupBy('approval_id')
                ->map(fn($g) => $g->pluck('subservice_id')->toArray());

            foreach ($pastApprovals as $pa) {
                $pa->service_ids = $approvalServices[$pa->approval_id] ?? [];
                $pa->subservice_ids = $approvalSubservices[$pa->approval_id] ?? [];
            }

            $approvalsByApp = $pastApprovals->groupBy('application_id');

            $pastLogs = DB::table('application_logs as al')
                ->join('users as u', 'al.action_by', '=', 'u.user_id')
                ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                ->leftJoin('workflow_steps as ws', 'al.workflow_step_id', '=', 'ws.workflow_step_id')
                ->leftJoin('roles as r', 'ws.role_id', '=', 'r.id')
                ->whereIn('al.application_id', $allAppIds)
                ->whereIn('al.action', ['Returned for Correction', 'Final Rejection', 'Rejected'])
                ->select([
                    'al.application_id',
                    'al.remarks',
                    DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as reviewer_name"),
                    'r.name as reviewer_role',
                    'al.action as step_action',
                    'al.created_at as action_date',
                    DB::raw("'log' as record_type")
                ])
                ->get();

            $logsByApp = $pastLogs->groupBy('application_id');
        }

        foreach ($apps as $app) {
            $appApprovals = collect($approvalsByApp[$app->id] ?? []);
            $appLogs = collect($logsByApp[$app->id] ?? []);

            if (!empty($app->parent_application_id)) {
                $appApprovals = $appApprovals->concat($approvalsByApp[$app->parent_application_id] ?? []);
                $appLogs = $appLogs->concat($logsByApp[$app->parent_application_id] ?? []);
            }

            $history = $appApprovals->concat($appLogs)->sortBy('action_date');

            $pastReviewers = [];
            foreach ($history as $h) {
                $pastReviewers[] = [
                    'name' => $h->reviewer_name,
                    'role' => $h->reviewer_role,
                    'action' => $h->step_action,
                    'date' => $h->action_date,
                    'remarks' => $h->remarks ?? null,
                    'duration' => $h->duration ?? null,
                    'service_ids' => $h->service_ids ?? [],
                    'subservice_ids' => $h->subservice_ids ?? []
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
            $rules['rejection_reason'] = 'required|string|max:255';
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
                    $services = [
                        'service_ids' => $request->service_ids ?? [],
                        'subservice_ids' => $request->subservice_ids ?? []
                    ];
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

        $trackerService = new \App\Services\TrackerService();
        return $trackerService->getDetails($targetId);
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

    /**
     * GET /api/review/applications/{id}/diff
     * Returns side-by-side comparison of current application with its parent (reapplied from).
     */
    public function diff(Request $request, int $id): JsonResponse
    {
        $app = DB::table('applications')->where('id', $id)->first();
        if (!$app) {
            return response()->json(['error' => 'Application not found'], 404);
        }

        if (!$app->parent_application_id) {
            return response()->json(['has_comparison' => false]);
        }

        $current = $this->getApplicationDetailsForDiff($id);
        $previous = $this->getApplicationDetailsForDiff($app->parent_application_id);

        if (!$current || !$previous) {
            return response()->json(['has_comparison' => false]);
        }

        return response()->json([
            'has_comparison' => true,
            'current' => $current,
            'previous' => $previous
        ]);
    }

    private function getApplicationDetailsForDiff(int $appId)
    {
        $app = DB::table('applications as app')
            ->leftJoin('systems as sys', 'app.assigned_system_id', '=', 'sys.id')
            ->leftJoin('subsystems as subsys', 'app.assigned_subsystem_id', '=', 'subsys.id')
            ->where('app.id', $appId)
            ->select([
                'app.id',
                'app.application_id',
                'app.ligo_member',
                'app.duration',
                'sys.name as system_name',
                'subsys.name as subsystem_name',
                'app.id_card_path',
                'app.user_id',
                'app.profile_snapshot'
            ])
            ->first();

        if (!$app)
            return null;

        $snapshot = $app->profile_snapshot ? json_decode($app->profile_snapshot, true) : null;

        $name = 'N/A';
        $designation = 'N/A';
        $institute = 'N/A';
        $qualification = 'N/A';
        $phone = 'N/A';
        $country = 'N/A';
        $supervisorName = 'Not Assigned / Unknown';
        $idCardPath = $app->id_card_path;

        if ($snapshot) {
            if (!empty($snapshot['personal'])) {
                $p = $snapshot['personal'];
                $name = implode(' ', array_filter([$p['title'] ?? null, $p['first_name'] ?? null, $p['middle_name'] ?? null, $p['last_name'] ?? null]));
            }
            if (!empty($snapshot['affiliation'])) {
                $designation = $snapshot['affiliation']['category_name'] ?? 'N/A';
                $institute = $snapshot['affiliation']['institute_name'] ?? 'N/A';
                if (!empty($snapshot['affiliation']['id_card_path'])) {
                    $idCardPath = $snapshot['affiliation']['id_card_path'];
                }
            }
            if (!empty($snapshot['qualification'])) {
                $q = $snapshot['qualification'];
                $qualification = implode(', ', array_filter([$q['highest_qualification'] ?? null, $q['field_of_study'] ?? null, $q['university'] ?? null]));
            }
            if (!empty($snapshot['contact'])) {
                $phone = $snapshot['contact']['phone_number'] ?? 'N/A';
                $country = $snapshot['contact']['country_name'] ?? 'N/A';
            }
            $supervisorName = $snapshot['supervisor'] ?? 'Not Assigned / Unknown';
        } else {
            $profile = DB::table('user_profiles')->where('user_id', $app->user_id)->first();
            if ($profile) {
                $name = implode(' ', array_filter([$profile->title, $profile->first_name, $profile->middle_name, $profile->last_name]));
            }
            $aff = DB::table('user_affilation as ua')
                ->leftJoin('institutes as i', 'ua.institute_id', '=', 'i.id')
                ->leftJoin('categories as c', 'ua.category_id', '=', 'c.id')
                ->where('ua.user_id', $app->user_id)
                ->select(['i.name as institute_name', 'c.name as category_name'])
                ->first();
            if ($aff) {
                $designation = $aff->category_name ?? 'N/A';
                $institute = $aff->institute_name ?? 'N/A';
            }
            $qual = DB::table('user_qualification')->where('user_id', $app->user_id)->first();
            if ($qual) {
                $qualification = implode(', ', array_filter([$qual->highest_qualification, $qual->field_of_study, $qual->university]));
            }
            $con = DB::table('user_contacts')->where('user_id', $app->user_id)->first();
            if ($con) {
                $phone = $con->phone_number ?? 'N/A';
                $country = $con->country_name ?? 'N/A';
            }

            $supervisorRoleId = DB::table('roles')->where('slug', self::SUPERVISOR_ROLE_SLUG)->value('id');
            $supervisorStep = DB::table('workflow_steps')->where('role_id', $supervisorRoleId)->first();
            if ($supervisorStep) {
                $approval = DB::table('application_approvals as aa')
                    ->join('users as u', 'aa.approved_by', '=', 'u.user_id')
                    ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                    ->where('aa.application_id', $appId)
                    ->where('aa.workflow_step_id', $supervisorStep->workflow_step_id)
                    ->select(DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as supervisor_name"))
                    ->first();
                if ($approval) {
                    $supervisorName = $approval->supervisor_name;
                } else {
                    $log = DB::table('application_logs as al')
                        ->join('users as u', 'al.action_by', '=', 'u.user_id')
                        ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                        ->where('al.application_id', $appId)
                        ->where('al.workflow_step_id', $supervisorStep->workflow_step_id)
                        ->select(DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as supervisor_name"))
                        ->first();
                    if ($log) {
                        $supervisorName = $log->supervisor_name;
                    }
                }
            }
            if ($supervisorName === 'Not Assigned / Unknown') {
                $currSuper = DB::table('user_supervisors as us')
                    ->join('users as u', 'us.supervisor_id', '=', 'u.user_id')
                    ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                    ->where('us.user_id', $app->user_id)
                    ->where('us.is_active', true)
                    ->select(DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as supervisor_name"))
                    ->first();
                if ($currSuper) {
                    $supervisorName = $currSuper->supervisor_name;
                }
            }
        }

        // Recommended services
        $serviceIds = [];
        $subserviceIds = [];
        $approvals = DB::table('application_approvals')
            ->where('application_id', $appId)
            ->whereNotNull('recommended_services')
            ->get();
        foreach ($approvals as $appr) {
            $rs = json_decode($appr->recommended_services, true);
            if (!empty($rs['service_ids'])) {
                $serviceIds = array_unique(array_merge($serviceIds, $rs['service_ids']));
            }
            if (!empty($rs['subservice_ids'])) {
                $subserviceIds = array_unique(array_merge($subserviceIds, $rs['subservice_ids']));
            }
        }

        $services = [];
        if (!empty($serviceIds)) {
            $services = DB::table('services')->whereIn('id', $serviceIds)->pluck('name')->toArray();
        }
        $subservices = [];
        if (!empty($subserviceIds)) {
            $subservices = DB::table('subservices')->whereIn('id', $subserviceIds)->pluck('name')->toArray();
        }

        return [
            'application_id' => $app->application_id,
            'name' => $name,
            'designation' => $designation,
            'institute' => $institute,
            'qualification' => $qualification,
            'phone' => $phone,
            'country' => $country,
            'supervisor' => $supervisorName,
            'ligo_member' => $app->ligo_member === 'yes' ? 'Yes' : 'No',
            'duration' => $app->duration ? $app->duration : 'Not specified',
            'system' => $app->system_name ? $app->system_name : 'Not Assigned',
            'subsystem' => $app->subsystem_name ? $app->subsystem_name : 'Not Assigned',
            'services' => !empty($services) ? implode(', ', $services) : 'None',
            'subservices' => !empty($subservices) ? implode(', ', $subservices) : 'None',
            'id_card_filename' => $idCardPath ? basename($idCardPath) : 'None',
            'id_card_path' => $idCardPath
        ];
    }
}
