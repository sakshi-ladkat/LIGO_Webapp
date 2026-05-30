<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Workflow;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class AdminController extends Controller
{
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

    // ── Guard: only super_admin may call these endpoints ─────────────────────
    private function checkAdmin(Request $request, ?string $requiredPermission = null): ?JsonResponse
    {
        $userId = $request->auth_user_id;
        $isAdmin = DB::table('user_roles as ur')
            ->join('roles as r', 'ur.role_id', '=', 'r.id')
            ->where('ur.user_id', $userId)
            ->where('r.slug', 'super_admin')
            ->where('ur.is_active', true)
            ->exists();

        if ($isAdmin) {
            return null;
        }

        if ($requiredPermission) {
            $hasPerm = DB::table('user_roles as ur')
                ->join('roles_permissions as rp', 'ur.role_id', '=', 'rp.role_id')
                ->join('permissions as p', 'rp.permission_id', '=', 'p.id')
                ->where('ur.user_id', $userId)
                ->where('ur.is_active', true)
                ->where('p.slug', $requiredPermission)
                ->exists();
            if ($hasPerm) {
                return null;
            }
        } else {
            $ADMIN_PERMISSIONS = [
                'view_applications',
                'manage_users',
                'manage_roles',
                'assign_roles',
                'approve_identity',
                'manage_institutes',
                'manage_systems',
                'manage_services',
                'manage_categories',
                'manage_durations',
                'manage_salutations',
                'manage_requests',
                'system_settings',
                'view_logs',
                'manage_workflows'
            ];
            $hasAnyPerm = DB::table('user_roles as ur')
                ->join('roles_permissions as rp', 'ur.role_id', '=', 'rp.role_id')
                ->join('permissions as p', 'rp.permission_id', '=', 'p.id')
                ->where('ur.user_id', $userId)
                ->where('ur.is_active', true)
                ->whereIn('p.slug', $ADMIN_PERMISSIONS)
                ->exists();
            if ($hasAnyPerm) {
                return null;
            }
        }

        return response()->json(['error' => 'Forbidden'], 403);
    }

    private function getPermissionForEntity(string $entity): string
    {
        return match ($entity) {
            'categories' => 'manage_categories',
            'roles' => 'manage_roles',
            'services', 'subservices' => 'manage_services',
            'systems', 'subsystems' => 'manage_systems',
            'requests' => 'manage_requests',
            'workflows', 'workflow-steps' => 'manage_workflows',
            'durations' => 'manage_durations',
            'salutations', 'titles' => 'manage_salutations',
            'institutes' => 'manage_institutes',
            default => 'super_admin'
        };
    }

    // ════════════════════════════════════════════════════════════
    // APPLICATIONS
    // ════════════════════════════════════════════════════════════

    /**
     * GET /api/admin/applications
     * Returns all applications with rich detail for the admin table.
     */
    public function allApplications(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'view_applications'))
            return $err;

        $appsQuery = DB::table('applications as app')
            ->join('workflows as wf', 'app.workflow_id', '=', 'wf.workflow_id')
            ->join('requests as req', 'app.request_id', '=', 'req.id')
            ->join('users as u', 'app.user_id', '=', 'u.user_id')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->leftJoin('user_affilation as ua', 'u.user_id', '=', 'ua.user_id')
            ->leftJoin('institutes as i', 'ua.institute_id', '=', 'i.id')
            ->leftJoin('categories as cat', 'ua.category_id', '=', 'cat.id')
            ->leftJoin('workflow_steps as ws', 'app.current_step_id', '=', 'ws.workflow_step_id')
            ->leftJoin('workflow_statuses as wst', 'ws.status_id', '=', 'wst.id')
            ->leftJoin('workflow_actions as wa', 'ws.action_id', '=', 'wa.id');

        $userId = $request->auth_user_id;
        $isSuperAdmin = DB::table('user_roles as ur')
            ->join('roles as r', 'ur.role_id', '=', 'r.id')
            ->where('ur.user_id', $userId)
            ->where('r.slug', 'super_admin')
            ->where('ur.is_active', true)
            ->exists();

        if (!$isSuperAdmin) {
            $userRoleIds = DB::table('user_roles')
                ->where('user_id', $userId)
                ->where('is_active', true)
                ->pluck('role_id');

            $supervisorRoleId = DB::table('roles')->where('slug', 'supervisor')->value('id');
            $systemLeadRoleId = DB::table('roles')->where('slug', 'system_lead')->value('id');
            $subsystemLeadRoleId = DB::table('roles')->where('slug', 'subsystem_lead')->value('id');
            $liCoordinatorRoleId = DB::table('roles')->where('slug', 'li_coordinator')->value('id');

            $appsQuery->where(function ($q) use ($userId, $userRoleIds, $supervisorRoleId, $systemLeadRoleId, $subsystemLeadRoleId, $liCoordinatorRoleId) {
                // 1. Generic pool roles
                $targetedRoleIds = array_filter([$supervisorRoleId, $systemLeadRoleId, $subsystemLeadRoleId, $liCoordinatorRoleId]);
                $poolRoleIds = $userRoleIds->filter(fn($rid) => !in_array($rid, $targetedRoleIds))->values();
                if ($poolRoleIds->isNotEmpty()) {
                    $q->orWhere(function ($sub) use ($poolRoleIds) {
                        $sub->whereIn('ws.role_id', $poolRoleIds)
                            ->whereNull('app.current_assignee_id')
                            ->where('app.is_active', true)
                            ->where('app.status', '!=', 'id_proof_pending');
                    });
                }

                // 2. Personal supervisor pending applications
                if ($supervisorRoleId && $userRoleIds->contains($supervisorRoleId)) {
                    $q->orWhere(function ($sub) use ($userId, $supervisorRoleId) {
                        $sub->where('ws.role_id', $supervisorRoleId)
                            ->whereNull('app.current_assignee_id')
                            ->where('app.is_active', true)
                            ->where('app.status', '!=', 'id_proof_pending')
                            ->whereRaw('EXISTS (
                                SELECT 1 FROM user_supervisors usup
                                WHERE usup.user_id = app.user_id
                                AND usup.supervisor_id = ?
                                AND usup.is_active = 1
                            )', [$userId]);
                    });
                }

                // 3. System lead pending applications
                if ($systemLeadRoleId && $userRoleIds->contains($systemLeadRoleId)) {
                    $q->orWhere(function ($sub) use ($userId, $systemLeadRoleId) {
                        $sub->where('ws.role_id', $systemLeadRoleId)
                            ->whereNull('app.current_assignee_id')
                            ->where('app.is_active', true)
                            ->where('app.status', '!=', 'id_proof_pending')
                            ->whereRaw('EXISTS (
                                SELECT 1 FROM entity_assignments ea
                                LEFT JOIN subsystems sbs ON app.assigned_subsystem_id = sbs.id
                                WHERE ea.entity_type = "system"
                                AND ea.user_id = ?
                                AND (ea.entity_id = app.assigned_system_id OR ea.entity_id = sbs.system_id)
                                AND ea.is_active = 1
                            )', [$userId]);
                    });
                }

                // 4. Subsystem lead pending applications
                if ($subsystemLeadRoleId && $userRoleIds->contains($subsystemLeadRoleId)) {
                    $q->orWhere(function ($sub) use ($userId, $subsystemLeadRoleId) {
                        $sub->where('ws.role_id', $subsystemLeadRoleId)
                            ->whereNull('app.current_assignee_id')
                            ->where('app.is_active', true)
                            ->where('app.status', '!=', 'id_proof_pending')
                            ->whereRaw('EXISTS (
                                SELECT 1 FROM entity_assignments ea
                                WHERE ea.entity_type = "subsystem"
                                AND ea.user_id = ?
                                AND (ea.entity_id = app.assigned_subsystem_id OR app.assigned_subsystem_id IS NULL)
                                AND ea.is_active = 1
                            )', [$userId]);
                    });
                }

                // 5. LI-Coordinator pending applications
                if ($liCoordinatorRoleId && $userRoleIds->contains($liCoordinatorRoleId)) {
                    $q->orWhere(function ($sub) use ($userId, $liCoordinatorRoleId) {
                        $sub->where('ws.role_id', $liCoordinatorRoleId)
                            ->whereNull('app.current_assignee_id')
                            ->where('app.is_active', true)
                            ->where('app.status', '!=', 'id_proof_pending')
                            ->where(function ($liQ) use ($userId) {
                                // Identity
                                $liQ->where(function ($subId) use ($userId) {
                                    $subId->where('wa.slug', 'approve_identity')
                                        ->whereRaw('EXISTS (
                                            SELECT 1 FROM user_affilation ua
                                            JOIN user_affilation app_ua ON app_ua.user_id = app.user_id
                                            WHERE ua.user_id = ?
                                            AND ua.institute_id = app_ua.institute_id
                                        )', [$userId]);
                                })
                                    // Technical
                                    ->orWhere(function ($subTech) use ($userId) {
                                    $subTech->where('wa.slug', '!=', 'approve_identity')
                                        ->whereRaw('EXISTS (
                                            SELECT 1 FROM user_affilation ua
                                            JOIN systems s ON ua.institute_id = s.institute_id
                                            LEFT JOIN subsystems sbs ON app.assigned_subsystem_id = sbs.id
                                            WHERE ua.user_id = ?
                                            AND (s.id = app.assigned_system_id OR s.id = sbs.system_id)
                                        )', [$userId]);
                                })
                                    // Fallback Coordinator
                                    ->orWhereRaw('EXISTS (
                                    SELECT 1 FROM user_roles ur
                                    JOIN roles r ON ur.role_id = r.id
                                    WHERE ur.user_id = ?
                                    AND r.slug = "li_coordinator"
                                    AND ur.is_default = 1
                                )', [$userId]);
                            });
                    });
                }

                // 6. Direct assignee applications
                $q->orWhere('app.current_assignee_id', $userId);

                // 7. Applications previously acted on by this user (approvals)
                $q->orWhereRaw('EXISTS (
                    SELECT 1 FROM application_approvals aa
                    WHERE aa.application_id = app.id
                    AND aa.approved_by = ?
                )', [$userId]);

                // 8. Applications previously acted on by this user (logs)
                $q->orWhereRaw('EXISTS (
                    SELECT 1 FROM application_workflow_logs al
                    WHERE al.application_id = app.id
                    AND al.action_by = ?
                )', [$userId]);
            });
        }

        $apps = $appsQuery
            ->select([
                'app.id',
                'app.application_id',
                'app.status',
                'app.parent_application_id',
                'app.reapplied_from',
                ...($this->hasApplicationColumn('ligo_member') ? ['app.ligo_member'] : [DB::raw('NULL as ligo_member')]),
                ...($this->hasApplicationColumn('duration') ? ['app.duration'] : [DB::raw('NULL as duration')]),
                'app.created_at as submitted_at',
                ...($this->hasApplicationsApprovedAt() ? ['app.approved_at'] : [DB::raw('NULL as approved_at')]),
                DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as applicant_name"),
                'u.email as applicant_email',
                'u.user_id as applicant_user_id',
                'i.name as institute_name',
                'cat.name as category_name',
                DB::raw('COALESCE(app.id_card_path, ua.id_card_path) as id_card_path'),
                'wf.workflow_name',
                'req.name as request_name',
                'wst.name as current_status',
                DB::raw('NULL as approved_by_name'),
            ])
            ->orderByDesc('app.created_at')
            ->get();

        // For non-super-admin reviewers, compute stats that reflect their personal actions:
        // - "approved" = apps they have a recorded approval for (their step was completed by them)
        //   OR apps whose final status is approved/completed
        // - "pending" = apps they have NOT yet acted on (no approval record from them)
        // - "declined" = apps they declined OR apps whose final status is declined/rejected
        if (!$isSuperAdmin) {
            $appIds = $apps->pluck('id')->toArray();

            // IDs of applications this user has personally approved (any step)
            $approvedByUserIds = DB::table('application_approvals')
                ->whereIn('application_id', $appIds)
                ->where('approved_by', $userId)
                ->pluck('application_id')
                ->unique()
                ->toArray();

            // IDs of applications this user has declined/rejected (any step)
            $declinedByUserIds = DB::table('application_workflow_logs')
                ->whereIn('application_id', $appIds)
                ->where('action_by', $userId)
                ->whereIn('action', ['decline', 'final_rejection', 'Rejected', 'Final Rejection'])
                ->pluck('application_id')
                ->unique()
                ->toArray();

            // Tag each app with reviewer_actioned so the frontend shows the right status pill
            foreach ($apps as $app) {
                if (in_array($app->id, $approvedByUserIds)) {
                    $app->reviewer_actioned = 'approved';
                } elseif (in_array($app->id, $declinedByUserIds)) {
                    $app->reviewer_actioned = 'declined';
                } else {
                    $app->reviewer_actioned = null;
                }
            }

            $stats = [
                'total' => $apps->count(),
                // Pending = not yet actioned by this user, and not finally approved/declined
                'pending' => $apps->filter(function ($a) use ($approvedByUserIds, $declinedByUserIds) {
                    return !in_array($a->id, $approvedByUserIds)
                        && !in_array($a->id, $declinedByUserIds)
                        && !in_array($a->status, ['approved', 'declined', 'rejected', 'completed']);
                })->count(),
                // Approved = this user approved their step on the app, OR app is finally approved
                'approved' => $apps->filter(function ($a) use ($approvedByUserIds) {
                    return in_array($a->id, $approvedByUserIds)
                        || in_array($a->status, ['approved', 'active', 'completed']);
                })->count(),
                // Declined = this user declined, OR app is finally declined
                'declined' => $apps->filter(function ($a) use ($declinedByUserIds) {
                    return in_array($a->id, $declinedByUserIds)
                        || in_array($a->status, ['declined', 'rejected']);
                })->count(),
            ];
        } else {
            $stats = [
                'total' => $apps->count(),
                'pending' => $apps->whereNotIn('status', ['approved', 'declined', 'rejected', 'completed'])->count(),
                'approved' => $apps->whereIn('status', ['approved', 'active', 'completed'])->count(),
                'declined' => $apps->whereIn('status', ['declined', 'rejected'])->count(),
            ];
        }

        return response()->json(['applications' => $apps, 'stats' => $stats]);
    }

    /**
     * GET /api/admin/applications/{id}/logs
     * Returns the full audit trail / tracking timeline for one application.
     */
    public function applicationLogs(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'view_applications'))
            return $err;

        $logs = DB::table('application_workflow_logs as al')
            ->join('users as u', 'al.action_by', '=', 'u.user_id')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->leftJoin('workflow_steps as ws', 'al.workflow_step_id', '=', 'ws.workflow_step_id')
            ->leftJoin('workflow_statuses as wst', 'ws.status_id', '=', 'wst.id')
            ->leftJoin('roles as r', 'ws.role_id', '=', 'r.id')
            ->where('al.application_id', $id)
            ->select([
                'al.id',
                'al.action',
                'al.remarks',
                'al.created_at as timestamp',
                DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as actor_name"),
                'r.name as role_name',
                'wst.name as step_name',
                'al.role as role_slug',
            ])
            ->orderBy('al.created_at')
            ->get();

        return response()->json($logs);
    }

    /**
     * GET /api/admin/applications/{id}/tracker
     * Returns the full workflow timeline (all steps) for an application.
     */
    public function applicationTracker(Request $request, int $id): JsonResponse
    {
        return (new \App\Http\Controllers\WorkflowController)->unifiedTracker($request, $id);
    }



    // ════════════════════════════════════════════════════════════
    // INSTITUTES
    // ════════════════════════════════════════════════════════════

    /**
     * GET /api/admin/institutes
     * Returns all institutes ordered by is_active (active first) then name.
     */
    public function institutes(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_institutes'))
            return $err;

        $all = DB::table('institutes as inst')
            ->leftJoin('user_profiles as creator', 'inst.created_by', '=', 'creator.user_id')
            ->leftJoin('users as creator_u', 'inst.created_by', '=', 'creator_u.user_id')
            ->leftJoin('user_profiles as modifier', 'inst.modified_by', '=', 'modifier.user_id')
            ->leftJoin('users as modifier_u', 'inst.modified_by', '=', 'modifier_u.user_id')
            ->orderBy('inst.name')
            ->select([
                'inst.*',
                DB::raw("COALESCE(CONCAT(creator.first_name, ' ', creator.last_name), creator_u.email) as creator_name"),
                DB::raw("COALESCE(CONCAT(modifier.first_name, ' ', modifier.last_name), modifier_u.email) as modifier_name"),
            ])
            ->get();

        return response()->json(['all' => $all]);
    }

    /**
     * POST /api/admin/institutes
     * Directly register & approve a new institute (is_active = true).
     */
    public function createInstitute(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_institutes'))
            return $err;

        $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|unique:institutes,code',
        ]);

        $normalized = trim(preg_replace('/\s+/', ' ', strtolower($request->name)));

        $id = DB::table('institutes')->insertGetId([
            'name' => trim($request->name),
            'normalized_name' => $normalized,
            'is_user_suggested' => false,
            'code' => strtoupper($request->code),
            'city' => $request->city,
            'is_active' => true,
            'created_by' => $request->auth_user_id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Institute registered and approved.', 'id' => $id], 201);
    }

    /**
     * PATCH /api/admin/institutes/{id}/approve
     * Legacy endpoint kept for route compat — redirects to updateInstitute logic.
     */
    public function approveInstitute(Request $request, int $id): JsonResponse
    {
        return $this->updateInstitute($request, $id);
    }

    /**
     * PATCH /api/admin/institutes/{id}/toggle-status
     * Toggles is_active only (status field removed).
     */
    public function toggleInstituteStatus(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_institutes'))
            return $err;

        $inst = DB::table('institutes')->where('id', $id)->first();
        if (!$inst)
            return response()->json(['error' => 'Not found'], 404);

        $newActive = !$inst->is_active;

        DB::table('institutes')->where('id', $id)->update([
            'is_active' => $newActive,
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Visibility updated', 'is_active' => $newActive]);
    }

    /**
     * DELETE /api/admin/institutes/{id}
     * Deletes / declines a pending institute.
     */
    public function deleteInstitute(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_institutes'))
            return $err;

        DB::table('institutes')->where('id', $id)->delete();
        return response()->json(['message' => 'Institute removed.']);
    }

    /**
     * PATCH /api/admin/institutes/{id}
     * Edits institute name / code.
     */
    public function updateInstitute(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_institutes'))
            return $err;

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'code' => 'sometimes|string',
            'city' => 'sometimes|string|max:255',
        ]);

        $inst = DB::table('institutes')->where('id', $id)->first();
        if (!$inst) {
            return response()->json(['error' => 'Institute not found'], 404);
        }

        $data = [
            'updated_at' => now(),
        ];

        $hasChanged = false;

        if ($request->has('name')) {
            $newName = trim($request->name);
            if ($newName !== $inst->name) {
                $data['name'] = $newName;
                $data['normalized_name'] = trim(preg_replace('/\s+/', ' ', strtolower($newName)));
                $hasChanged = true;
            }
        }

        if ($request->has('code')) {
            $newCode = strtoupper($request->code);
            if ($newCode !== $inst->code) {
                $data['code'] = $newCode;
                $hasChanged = true;
            }
        }

        if ($request->has('city')) {
            $newCity = $request->city;
            if ($newCity !== $inst->city) {
                $data['city'] = $newCity;
                $hasChanged = true;
            }
        }

        if ($hasChanged) {
            $data['modified_by'] = $request->auth_user_id;
            DB::table('institutes')->where('id', $id)->update($data);
        } else {
            // Keep updated_at unchanged if no form fields changed
        }

        return response()->json(['message' => 'Institute updated.']);
    }

    // ════════════════════════════════════════════════════════════
    // USERS & ROLES
    // ════════════════════════════════════════════════════════════

    /**
     * GET /api/admin/roles
     * Returns all roles.
     */
    public function roles(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_roles'))
            return $err;
        $roles = DB::table('roles')->orderBy('level', 'desc')->orderBy('name')->get();

        foreach ($roles as $role) {
            $role->permissions = DB::table('roles_permissions as rp')
                ->join('permissions as p', 'rp.permission_id', '=', 'p.id')
                ->where('rp.role_id', $role->id)
                ->where('rp.is_active', true)
                ->select(['p.id', 'p.name', 'p.type', 'p.slug'])
                ->get();
        }

        return response()->json($roles);
    }

    /**
     * PATCH /api/auth/admin/roles/{id}/toggle
     */
    public function toggleRole(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_roles'))
            return $err;

        $role = DB::table('roles')->where('id', $id)->first();
        if (!$role)
            return response()->json(['error' => 'Role not found'], 404);

        DB::table('roles')->where('id', $id)->update([
            'is_active' => !$role->is_active,
            'updated_at' => now()
        ]);

        return response()->json(['message' => 'Role status updated']);
    }

    /**
     * GET /api/auth/admin/permissions
     */
    public function permissions(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_roles'))
            return $err;
        $permissions = DB::table('permissions')->orderBy('type')->orderBy('name')->get();
        return response()->json($permissions);
    }

    /**
     * POST /api/admin/users/assign-role
     * Assign a role to a user (matched by email).
     */
    public function assignRole(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'assign_roles'))
            return $err;

        $request->validate([
            'email' => 'required|email|exists:users,email',
            'role_id' => 'required|exists:roles,id',
            'entity_type' => 'nullable|string|in:system,subsystem',
            'entity_id' => 'nullable|integer',
        ]);

        $user = DB::table('users')->where('email', $request->email)->first();
        if (!$user) {
            return response()->json(['error' => 'User not found.'], 404);
        }

        if ($user->status === 'deactivated') {
            return response()->json(['error' => 'Cannot assign roles or access to a blocked user.'], 422);
        }

        $role = DB::table('roles')->where('id', $request->role_id)->first();
        if (!$role) {
            return response()->json(['error' => 'Role not found.'], 404);
        }

        // Prevent duplicate assignment of the exact same active role
        $existingSameActive = DB::table('user_roles')
            ->where('user_id', $user->user_id)
            ->where('role_id', $request->role_id)
            ->where('is_active', true)
            ->exists();
        if ($existingSameActive) {
            return response()->json(['error' => 'This user is already actively assigned this role.'], 422);
        }

        // Fetch user's institute
        $instituteId = $request->input('institute_id');
        if (!$instituteId) {
            $instituteId = DB::table('users')->where('user_id', $user->user_id)->value('institute_id');
        }
        if (!$instituteId) {
            $instituteId = DB::table('user_affilation')->where('user_id', $user->user_id)->value('institute_id');
        }

        // Retrieve current active role for logging
        $previousRoleEntry = DB::table('user_roles')
            ->where('user_id', $user->user_id)
            ->where('is_active', true)
            ->first();
        $previousRoleName = null;
        if ($previousRoleEntry) {
            $prevRole = DB::table('roles')->where('id', $previousRoleEntry->role_id)->first();
            $previousRoleName = $prevRole ? $prevRole->name : $previousRoleEntry->role;
        }

        DB::beginTransaction();
        try {
            // Special handling for LI-Coordinator
            if ($role->slug === 'li_coordinator' || $role->name === 'LI-Coordinator') {
                if (!$instituteId) {
                    return response()->json(['error' => 'User has no affiliated institute. An institute affiliation is required to assign the LI-Coordinator role.'], 422);
                }

                // Check existing LI Coordinator status on the institute
                $hasCoordinatorStatus = DB::table('institutes')
                    ->where('id', $instituteId)
                    ->value('has_li_coordinator');

                if ($hasCoordinatorStatus) {
                    // Find existing active LI-Coordinator for that institute and deactivate
                    DB::table('user_roles')
                        ->where('institute_id', $instituteId)
                        ->where(function ($query) {
                            $query->where('role', 'LI-Coordinator')
                                ->orWhere('role_id', 3); // 3 is standard LI-Coordinator role ID
                        })
                        ->where('is_active', true)
                        ->update([
                            'is_active' => false,
                            'updated_at' => now()
                        ]);
                } else {
                    // If no coordinator status, update institute table
                    DB::table('institutes')
                        ->where('id', $instituteId)
                        ->update([
                            'has_li_coordinator' => true,
                            'updated_at' => now()
                        ]);
                }

                // Deactivate all current roles of the target user to preserve history
                DB::table('user_roles')
                    ->where('user_id', $user->user_id)
                    ->where('is_active', true)
                    ->update([
                        'is_active' => false,
                        'updated_at' => now()
                    ]);

                // Always insert or update to preserve history and respect unique constraints
                DB::table('user_roles')->updateOrInsert(
                    [
                        'user_id' => $user->user_id,
                        'role_id' => $role->id,
                    ],
                    [
                        'is_active' => true,
                        'updated_at' => now(),
                        'assigned_by' => $request->auth_user_id
                    ]
                );

            } else {
                // Deactivate all current roles of the target user to preserve history
                DB::table('user_roles')
                    ->where('user_id', $user->user_id)
                    ->where('is_active', true)
                    ->update([
                        'is_active' => false,
                        'updated_at' => now()
                    ]);

                // Always insert or update to preserve history and respect unique constraints
                DB::table('user_roles')->updateOrInsert(
                    [
                        'user_id' => $user->user_id,
                        'role_id' => $role->id,
                    ],
                    [
                        'is_active' => true,
                        'updated_at' => now(),
                        'assigned_by' => $request->auth_user_id
                    ]
                );

                // If user was previously an active LI-Coordinator for this institute,
                // check if any other active LI-Coordinators exist. If none, update institutes.has_li_coordinator to false.
                if ($previousRoleName === 'LI-Coordinator' && $instituteId) {
                    $otherActiveCoordinators = DB::table('user_roles')
                        ->where('institute_id', $instituteId)
                        ->where(function ($query) {
                            $query->where('role', 'LI-Coordinator')
                                ->orWhere('role_id', 3);
                        })
                        ->where('is_active', true)
                        ->count();

                    if ($otherActiveCoordinators === 0) {
                        DB::table('institutes')
                            ->where('id', $instituteId)
                            ->update([
                                'has_li_coordinator' => false,
                                'updated_at' => now()
                            ]);
                    }
                }
            }

            // Sync affiliation if institute_id and category_id are provided (e.g. from original admin form)
            if ($request->has('institute_id') && $request->has('category_id')) {
                DB::table('user_affilation')->updateOrInsert(
                    ['user_id' => $user->user_id],
                    [
                        'institute_id' => $request->institute_id,
                        'category_id' => $request->category_id,
                        'is_active' => true,
                        'updated_at' => now()
                    ]
                );
            }

            // Sync Entity Lead if entity type/id are provided (system or subsystem)
            if ($request->entity_type && $request->entity_id) {
                // Deactivate any existing active leads for this entity
                DB::table('entity_assignments')
                    ->where('entity_type', $request->entity_type)
                    ->where('entity_id', $request->entity_id)
                    ->where('is_active', true)
                    ->update(['is_active' => false, 'deactivated_at' => now()]);

                // Insert new assignment
                DB::table('entity_assignments')->insert([
                    'entity_type' => $request->entity_type,
                    'entity_id' => $request->entity_id,
                    'user_id' => $user->user_id,
                    'is_active' => true,
                    'assigned_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }

            // Audit Log in role_assignment_logs
            DB::table('role_assignment_logs')->insert([
                'assigned_by' => $request->auth_user_id,
                'user_id' => $user->user_id,
                'previous_role' => $previousRoleName,
                'new_role' => $role->name,
                'institute_id' => $instituteId,
                'created_at' => now(),
                'updated_at' => now()
            ]);

            DB::commit();
            return response()->json(['message' => 'Role and affiliation updated successfully.']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Failed to update: ' . $e->getMessage()], 500);
        }
    }

    /**
     * PATCH /api/admin/users/{id}/toggle-block
     * Toggles a user's active/blocked status.
     */
    public function toggleUserBlock(Request $request, $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_users'))
            return $err;

        $user = DB::table('users')->where('user_id', $id)->first();
        if (!$user) {
            return response()->json(['error' => 'User not found.'], 404);
        }

        // Prevent self blocking
        if ($user->user_id == $request->auth_user_id) {
            return response()->json(['error' => 'You cannot block your own account.'], 400);
        }

        $isCurrentlyBlocked = $user->status === 'deactivated';
        $newBlockState = !$isCurrentlyBlocked;
        $reason = $request->input('reason');

        DB::beginTransaction();
        try {
            DB::table('users')->where('user_id', $id)->update([
                'status' => $newBlockState ? 'deactivated' : 'active',
                'updated_at' => now(),
            ]);

            DB::table('block_history')->insert([
                'user_id' => $user->user_id,
                'blocked_by' => $request->auth_user_id,
                'action' => $newBlockState ? 'block' : 'unblock',
                'reason' => $reason,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Failed to toggle user block state: ' . $e->getMessage()], 500);
        }

        $msg = $newBlockState ? 'User blocked successfully.' : 'User unblocked successfully.';
        return response()->json(['message' => $msg, 'is_blocked' => $newBlockState]);
    }

    /**
     * POST /api/admin/roles
     */
    public function storeRole(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_roles'))
            return $err;
        $request->validate([
            'name' => 'required|string|unique:roles,name',
            'slug' => 'required|string|unique:roles,slug',
            'level' => 'required|string',
            'permissions' => 'nullable|array'
        ]);

        DB::beginTransaction();
        try {
            $id = DB::table('roles')->insertGetId([
                'name' => $request->name,
                'slug' => $request->slug,
                'level' => $request->level,
                'created_at' => now(),
                'updated_at' => now()
            ]);

            if ($request->has('permissions')) {
                foreach ($request->permissions as $pId) {
                    DB::table('roles_permissions')->insert([
                        'role_id' => $id,
                        'permission_id' => $pId,
                        'is_active' => true,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]);
                }
            }

            DB::commit();
            return response()->json(['message' => 'Role created successfully', 'id' => $id]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * PATCH /api/admin/roles/{id}
     */
    public function updateRole(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_roles'))
            return $err;

        DB::beginTransaction();
        try {
            DB::table('roles')->where('id', $id)->update(array_filter([
                'name' => $request->name,
                'slug' => $request->slug,
                'level' => $request->level,
                'updated_at' => now()
            ]));

            if ($request->has('permissions')) {
                // Delete existing permissions for this role
                DB::table('roles_permissions')->where('role_id', $id)->delete();
                
                // Insert new ones
                foreach ($request->permissions as $pId) {
                    DB::table('roles_permissions')->insert([
                        'role_id' => $id,
                        'permission_id' => $pId,
                        'is_active' => true,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]);
                }
            }

            DB::commit();
            return response()->json(['message' => 'Role updated']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/admin/categories
     */
    public function storeCategory(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_categories'))
            return $err;
        $request->validate([
            'name' => 'required|string',
            'parent_id' => 'nullable|exists:categories,id',
            'slug' => 'required|string|unique:categories,slug'
        ]);

        $id = DB::table('categories')->insertGetId([
            'name' => $request->name,
            'parent_id' => $request->parent_id,
            'slug' => $request->slug,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now()
        ]);
        return response()->json(['message' => 'Category created', 'id' => $id]);
    }

    public function toggleCategoryStatus(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_categories'))
            return $err;
        $cat = DB::table('categories')->where('id', $id)->first();
        if (!$cat)
            return response()->json(['error' => 'Category not found'], 404);

        DB::table('categories')->where('id', $id)->update([
            'is_active' => !((object) $cat)->is_active,
            'updated_at' => now()
        ]);
        return response()->json(['message' => 'Status updated']);
    }

    public function storeService(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_services'))
            return $err;
        $request->validate([
            'name' => 'required|string',
            'code' => 'required|string|unique:services,code',
            'subsystem_id' => 'required|exists:subsystems,id',
            'type' => 'nullable|string',
            'description' => 'nullable|string'
        ]);

        $id = DB::table('services')->insertGetId([
            'name' => $request->name,
            'code' => $request->code,
            'subsystem_id' => $request->subsystem_id,
            'type' => $request->type ?? 'General',
            'description' => $request->description,
            'is_ligo' => $request->is_ligo ? 1 : 0,
            'is_computing' => $request->is_computing ? 1 : 0,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now()
        ]);
        return response()->json(['message' => 'Service created', 'id' => $id]);
    }

    public function storeSubservice(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_services'))
            return $err;
        $request->validate([
            'name' => 'required|string',
            'code' => 'required|string|unique:subservices,code',
            'service_id' => 'required|exists:services,id',
            'type' => 'nullable|string',
            'description' => 'nullable|string'
        ]);

        $id = DB::table('subservices')->insertGetId([
            'name' => $request->name,
            'code' => $request->code,
            'service_id' => $request->service_id,
            'type' => $request->type ?? 'General',
            'description' => $request->description,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now()
        ]);
        return response()->json(['message' => 'Sub-service created', 'id' => $id]);
    }

    public function storeSystem(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_systems'))
            return $err;
        $request->validate([
            'name' => 'required|string',
            'code' => 'required|string|unique:systems,code',
            'type' => 'required|string',
            'description' => 'nullable|string',
            'institute_id' => 'required|exists:institutes,id',
            'lead_id' => 'required|exists:users,user_id',
        ]);

        DB::beginTransaction();
        try {
            $id = DB::table('systems')->insertGetId([
                'name' => $request->name,
                'code' => $request->code,
                'type' => $request->type,
                'description' => $request->description,
                'institute_id' => $request->institute_id,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now()
            ]);

            DB::table('entity_assignments')->insert([
                'entity_type' => 'system',
                'entity_id' => $id,
                'user_id' => $request->lead_id,
                'is_active' => true,
                'assigned_at' => now(),
                'created_at' => now(),
                'updated_at' => now()
            ]);

            DB::commit();
            return response()->json(['message' => 'System created', 'id' => $id]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Creation failed: ' . $e->getMessage()], 500);
        }
    }

    public function storeSubsystem(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_systems'))
            return $err;
        $request->validate([
            'name' => 'required|string',
            'code' => 'required|string|unique:subsystems,code',
            'type' => 'required|string',
            'system_id' => 'required|exists:systems,id',
            'lead_id' => 'required|exists:users,user_id',
            'description' => 'nullable|string',
        ]);

        DB::beginTransaction();
        try {
            $id = DB::table('subsystems')->insertGetId([
                'name' => $request->name,
                'code' => $request->code,
                'type' => $request->type,
                'system_id' => $request->system_id,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now()
            ]);

            DB::table('entity_assignments')->insert([
                'entity_type' => 'subsystem',
                'entity_id' => $id,
                'user_id' => $request->lead_id,
                'is_active' => true,
                'assigned_at' => now(),
                'created_at' => now(),
                'updated_at' => now()
            ]);

            DB::commit();
            return response()->json(['message' => 'Sub-system created', 'id' => $id]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Creation failed: ' . $e->getMessage()], 500);
        }
    }

    public function changeLead(Request $request, string $type, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_systems'))
            return $err;
        $request->validate([
            'user_id' => 'required|exists:users,user_id'
        ]);

        DB::beginTransaction();
        try {
            // Deactivate current lead
            DB::table('entity_assignments')
                ->where('entity_type', $type)
                ->where('entity_id', $id)
                ->where('is_active', true)
                ->update([
                    'is_active' => false,
                    'deactivated_at' => now(),
                    'updated_at' => now()
                ]);

            // Add new lead
            DB::table('entity_assignments')->insert([
                'entity_type' => $type,
                'entity_id' => $id,
                'user_id' => $request->user_id,
                'is_active' => true,
                'assigned_at' => now(),
                'created_at' => now(),
                'updated_at' => now()
            ]);

            DB::commit();
            return response()->json(['message' => 'Lead updated successfully']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Failed to update lead'], 500);
        }
    }

    /**
     * POST /api/admin/data/{entity}
     */
    public function storeSimpleEntity(Request $request, string $entity): JsonResponse
    {
        if ($err = $this->checkAdmin($request, $this->getPermissionForEntity($entity)))
            return $err;
        $request->validate(['name' => 'required|string']);

        $table = match ($entity) {
            'titles' => 'titles',
            'durations' => 'durations',
            'requests' => 'requests',
            default => null
        };
        if (!$table)
            return response()->json(['error' => 'Invalid entity'], 400);

        $id = DB::table($table)->insertGetId([
            'name' => $request->name,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now()
        ]);
        return response()->json(['message' => ucfirst($entity) . ' created', 'id' => $id]);
    }

    /**
     * POST /api/admin/workflows
     */
    public function storeWorkflow(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_workflows'))
            return $err;
        $request->validate(['name' => 'required|string']);

        $id = DB::table('workflows')->insertGetId([
            'workflow_name' => $request->name,
            'workflow_description' => $request->description ?? '',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now()
        ]);
        return response()->json(['message' => 'Workflow created', 'id' => $id]);
    }

    /**
     * POST /api/admin/workflow-steps
     */
    public function storeWorkflowStep(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_workflows'))
            return $err;
        $request->validate([
            'workflow_id' => 'required|integer',
            'role_id' => 'required|integer',
            'step_action' => 'required|string',
            'status_name' => 'required|string'
        ]);

        $stepNo = $request->input('step_no');
        if (!$stepNo) {
            $stepNo = (DB::table('workflow_steps')
                ->where('workflow_id', $request->workflow_id)
                ->max('step_no') ?? 0) + 1;
        }

        $id = DB::table('workflow_steps')->insertGetId([
            'workflow_id' => $request->workflow_id,
            'step_no' => $stepNo,
            'role_id' => $request->role_id,
            'step_action' => $request->step_action,
            'status_name' => $request->status_name,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now()
        ]);
        return response()->json(['message' => 'Workflow step added', 'id' => $id]);
    }

    /**
     * POST /api/admin/workflows/bulk-steps
     */
    public function storeWorkflowStepBulk(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_workflows'))
            return $err;

        $request->validate([
            'steps' => 'required|array|min:1',
            'steps.*.workflow_id' => 'required|integer',
            'steps.*.role_id' => 'required|integer',
            'steps.*.step_action' => 'required|string',
            'steps.*.status_name' => 'required|string'
        ]);

        $workflowId = $request->steps[0]['workflow_id'];

        /** @var Workflow|null $oldWorkflow */
        $oldWorkflow = Workflow::with('steps')->find($workflowId);
        if (!$oldWorkflow) {
            return response()->json(['error' => 'Workflow not found.'], 404);
        }

        $incomingSteps = [];
        foreach ($request->steps as $stepData) {
            $actionId = DB::table('workflow_actions')->where('slug', $stepData['step_action'])->value('id');
            $statusName = trim($stepData['status_name']);
            $statusId = DB::table('workflow_statuses')->where('name', $statusName)->value('id');
            
            if (!$statusId) {
                $statusSlug = \Illuminate\Support\Str::slug($statusName);
                $statusId = DB::table('workflow_statuses')->insertGetId([
                    'name' => $statusName,
                    'slug' => $statusSlug,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            $incomingSteps[] = [
                'role_id' => $stepData['role_id'],
                'action_id' => $actionId,
                'status_id' => $statusId,
            ];
        }

        $allVersions = Workflow::with('steps')
            ->where('workflow_name', $oldWorkflow->workflow_name)
            ->get();

        foreach ($allVersions as $v) {
            $existingSteps = $v->steps->sortBy('step_no')->values();
            if ($existingSteps->count() !== count($incomingSteps))
                continue;
            if ($existingSteps->count() === 0)
                continue; // Skip empty shells

            $isDuplicate = true;
            foreach ($existingSteps as $index => $es) {
                $is = $incomingSteps[$index];
                if (
                    $es->role_id != $is['role_id'] ||
                    $es->action_id != $is['action_id'] ||
                    $es->status_id != $is['status_id']
                ) {
                    $isDuplicate = false;
                    break;
                }
            }

            if ($isDuplicate) {
                if (!$v->is_active) {
                    $v->is_active = true;
                    $v->save();
                    return response()->json(['message' => 'An identical inactive workflow was found and successfully reactivated.', 'workflow' => $v]);
                }
                
                $statusMsg = $v->is_active ? 'Active' : 'Inactive';
                return response()->json([
                    'error' => "This exact workflow already exists as '{$v->workflow_name}' (v{$v->version}) and its status is {$statusMsg}."
                ], 422);
            }
        }

        DB::transaction(function () use ($oldWorkflow, $request) {
            $isBrandNew = $oldWorkflow->steps()->count() === 0;

            if ($isBrandNew) {
                // It's a brand new empty shell workflow. No need to clone, just populate v1.
                $newWorkflow = $oldWorkflow;
            } else {
                // It has existing steps, so we must clone to protect inflight applications.
                $newWorkflow = $oldWorkflow->cloneAsNewVersion();
            }

            // We do NOT copy old steps, because the frontend bulk submission provides the complete new step definition.
            $currentMaxStep = 0;
            $totalSteps = count($request->steps);
            $index = 0;

            foreach ($incomingSteps as $stepData) {
                $currentMaxStep++; // Always append new steps sequentially
                $isFinal = ($index === $totalSteps - 1);

                $newWorkflow->steps()->create([
                    'step_no' => $currentMaxStep,
                    'role_id' => $stepData['role_id'],
                    'action_id' => $stepData['action_id'],
                    'status_id' => $stepData['status_id'],
                    'is_final_step' => $isFinal,
                    'is_active' => true,
                ]);
                $index++;
            }

            if (!$isBrandNew) {
                $oldWorkflow->update(['is_latest' => false, 'is_active' => false]);
            }
        });

        return response()->json(['message' => 'Workflow steps added successfully']);
    }

    /**
     * PATCH /api/admin/data/{entity}/{id}/toggle
     */
    public function toggleSimpleEntityStatus(Request $request, string $entity, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request, $this->getPermissionForEntity($entity)))
            return $err;

        $table = match ($entity) {
            'titles' => 'titles',
            'durations' => 'durations',
            'requests' => 'requests',
            'services' => 'services',
            'subservices' => 'subservices',
            'systems' => 'systems',
            'subsystems' => 'subsystems',
            'categories' => 'categories',
            'workflows' => 'workflows',
            // 'workflow-steps' => 'workflow_steps', // Toggling workflow steps directly is no longer allowed (versioning restriction)
            default => null
        };
        if (!$table)
            return response()->json(['error' => 'Invalid entity. Toggling workflow steps is not permitted.'], 400);

        $pk = match ($entity) {
            'workflows' => 'workflow_id',
            'workflow-steps' => 'workflow_step_id',
            default => 'id'
        };

        $row = DB::table($table)->where($pk, $id)->first();
        if (!$row)
            return response()->json(['error' => 'Not found'], 404);

        if ($entity === 'workflows' && !$row->is_active) {
            // Automatically deactivate any other active version of this workflow
            DB::table('workflows')
                ->where('workflow_name', $row->workflow_name)
                ->where('workflow_id', '!=', $id)
                ->update(['is_active' => false, 'is_latest' => false]);

            // When activating an older version manually, it becomes the latest routed version
            DB::table('workflows')->where('workflow_id', $id)->update(['is_latest' => true]);
        }

        DB::table($table)->where($pk, $id)->update([
            'is_active' => !$row->is_active,
            'updated_at' => now()
        ]);
        return response()->json(['message' => 'Status updated']);
    }

    // ════════════════════════════════════════════════════════════
    // MODIFY DATA — CRUD for each entity
    // ════════════════════════════════════════════════════════════

    /**
     * GET /api/admin/data/{entity}
     * Returns list for: categories | roles | services | requests | workflows
     */
    public function listEntity(Request $request, string $entity): JsonResponse
    {
        if ($err = $this->checkAdmin($request, $this->getPermissionForEntity($entity)))
            return $err;

        $data = match ($entity) {
            'categories' => DB::table('categories as c')
                ->leftJoin('categories as p', 'c.parent_id', '=', 'p.id')
                ->select(['c.*', 'p.name as parent_name'])
                ->orderBy('c.name')
                ->get(),
            'roles' => DB::table('roles')->orderBy('name')->get(),
            'services' => DB::table('services as s')
                ->leftJoin('subsystems as sub', 's.subsystem_id', '=', 'sub.id')
                ->select(['s.*', 'sub.name as parent_name'])
                ->orderBy('s.name')
                ->get()
                ->map(function ($s) {
                    $s->children = DB::table('subservices')->where('service_id', $s->id)->orderBy('name')->get();
                    return $s;
                }),
            'systems' => DB::table('systems as s')
                ->leftJoin('entity_assignments as ea', function ($join) {
                        $join->on('s.id', '=', 'ea.entity_id')->where('ea.entity_type', 'system')->where('ea.is_active', true);
                    })
                ->leftJoin('users as u', 'ea.user_id', '=', 'u.user_id')
                ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                ->when($request->institute_id, fn($q) => $q->where('s.institute_id', $request->institute_id))
                ->select(['s.*', DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as lead_name"), 'ea.user_id as lead_user_id'])
                ->orderBy('s.name')
                ->get()
                ->map(function ($s) {
                        $s->children = DB::table('subsystems as ss')
                        ->leftJoin('entity_assignments as ea', function ($join) {
                            $join->on('ss.id', '=', 'ea.entity_id')->where('ea.entity_type', 'subsystem')->where('ea.is_active', true);
                        })
                        ->leftJoin('users as u', 'ea.user_id', '=', 'u.user_id')
                        ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                        ->where('ss.system_id', $s->id)
                        ->select(['ss.*', DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as lead_name"), 'ea.user_id as lead_user_id'])
                        ->get();
                        return $s;
                    }),
            'subservices' => DB::table('subservices')->select(['*', 'name'])->orderBy('name')->get(),
            'requests' => DB::table('requests')->select(['*', 'name'])->orderBy('name')->get(),
            'workflows' => DB::table('workflows')->orderBy('workflow_name')->orderByDesc('version')->get()->map(function ($wf) {
                    $wf->id = $wf->workflow_id;
                    $wf->name = $wf->workflow_name . ' (v' . $wf->version . ')';
                    $wf->children = DB::table('workflow_steps as ws')
                    ->leftJoin('roles as r', 'ws.role_id', '=', 'r.id')
                    ->leftJoin('workflow_statuses as wst', 'ws.status_id', '=', 'wst.id')
                    ->where('ws.workflow_id', $wf->workflow_id)
                    ->select(['ws.*', 'ws.workflow_step_id as id', 'wst.name as name', 'r.name as role_name'])
                    ->orderBy('ws.step_no')
                    ->get();
                    return $wf;
                }),
            'subsystems' => DB::table('subsystems as ss')
                ->join('systems as s', 'ss.system_id', '=', 's.id')
                ->leftJoin('entity_assignments as ea', function ($join) {
                        $join->on('ss.id', '=', 'ea.entity_id')->where('ea.entity_type', 'subsystem')->where('ea.is_active', true);
                    })
                ->leftJoin('users as u', 'ea.user_id', '=', 'u.user_id')
                ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                ->when($request->institute_id, fn($q) => $q->where('s.institute_id', $request->institute_id))
                ->select(['ss.*', 's.name as system_name', DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as lead_name"), 'ea.user_id as lead_user_id'])
                ->orderBy('ss.name')
                ->get(),
            'institutes' => DB::table('institutes')->select(['*', 'name'])->orderBy('name')->get(),
            'titles' => DB::table('titles')->select(['*', 'name'])->orderBy('name')->get(),
            'durations' => DB::table('durations')->select(['*', 'name'])->get(),
            'workflow-actions' => DB::table('workflow_actions')->orderBy('name')->get(),
            'users' => DB::table('users as u')
                ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                ->leftJoin('user_roles as ur', function ($join) {
                        $join->on('u.user_id', '=', 'ur.user_id')->where('ur.is_active', true);
                    })
                ->leftJoin('roles as r', 'ur.role_id', '=', 'r.id')
                ->leftJoin('user_affilation as ua', 'u.user_id', '=', 'ua.user_id')
                ->leftJoin('institutes as i', 'ua.institute_id', '=', 'i.id')
                ->when($request->role_id, function ($q) use ($request) {
                        return $q->where('ur.role_id', $request->role_id);
                    })
                ->when($request->institute_id, function ($q) use ($request) {
                        return $q->where('ua.institute_id', $request->institute_id);
                    })
                ->select([
                    'u.user_id as id',
                    'u.email',
                    'u.status',
                    'u.status',
                    DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as name"),
                    'r.name as role_name',
                    'i.name as institute_name',
                    'i.code as institute_code'
                ])
                ->orderBy('u.created_at', 'desc')
                ->limit(200)
                ->get(),
            default => null,
        };

        if ($data === null) {
            return response()->json(['error' => 'Unknown entity.'], 400);
        }

        return response()->json($data);
    }

    /**
     * GET /api/admin/users/details?identifier=...
     * Returns detailed user affiliation, role, and category.
     */
    public function userDetails(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_users'))
            return $err;

        $id = $request->query('identifier');
        if (!$id)
            return response()->json(['error' => 'Identifier required'], 400);

        $u = DB::table('users as u')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->leftJoin('user_roles as ur', function ($join) {
                $join->on('u.user_id', '=', 'ur.user_id')->where('ur.is_active', true);
            })
            ->leftJoin('user_affilation as ua', 'u.user_id', '=', 'ua.user_id')
            ->leftJoin('institutes as i', 'ua.institute_id', '=', 'i.id')
            ->leftJoin('categories as c', 'ua.category_id', '=', 'c.id')
            ->where('u.user_id', $id)
            ->orWhere('u.email', $id)
            ->select([
                'u.user_id',
                'u.email',
                'u.status',
                DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as name"),
                'ur.role_id',
                'ua.institute_id',
                'i.name as institute_name',
                'ua.category_id',
                'c.name as category_name',
                'ua.entity_id'
            ])
            ->first();

        if (!$u)
            return response()->json(['error' => 'User not found'], 404);

        // Fetch supervisor if exists
        $supervisor = DB::table('user_supervisors as us')
            ->join('users as s', 'us.supervisor_id', '=', 's.user_id')
            ->leftJoin('user_profiles as sp', 's.user_id', '=', 'sp.user_id')
            ->where('us.user_id', $u->user_id)
            ->select(DB::raw("COALESCE(CONCAT(sp.first_name, ' ', sp.last_name), s.email) as supervisor_name"))
            ->first();

        $u->supervisor_name = $supervisor ? $supervisor->supervisor_name : null;

        return response()->json($u);
    }

    /**
     * GET /api/admin/workflows-full
     * Returns all workflows with their ordered steps and role info.
     */
    public function workflowsWithSteps(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_workflows'))
            return $err;

        $all = $request->boolean('all', false);
        $query = DB::table('workflows')->orderBy('workflow_name')->orderByDesc('version');
        if (!$all) {
            $query->where('is_latest', true);
        }
        $workflows = $query->get();

        $result = $workflows->map(function ($wf) {
            $steps = DB::table('workflow_steps as ws')
                ->leftJoin('roles as r', 'ws.role_id', '=', 'r.id')
                ->leftJoin('workflow_statuses as wst', 'ws.status_id', '=', 'wst.id')
                ->leftJoin('workflow_actions as wa', 'ws.action_id', '=', 'wa.id')
                ->where('ws.workflow_id', $wf->workflow_id)
                ->orderBy('ws.step_no')
                ->select([
                    'ws.workflow_step_id as id',
                    'ws.step_no',
                    'wst.name as status_name',
                    'wa.slug as step_action',
                    'ws.is_final_step',
                    'ws.is_active',
                    'r.name as role_name',
                    'r.slug as role_slug',
                ])
                ->get();

            return array_merge((array) $wf, [
                'id' => $wf->workflow_id,
                'name' => $wf->workflow_name,
                'children' => $steps
            ]);
        });

        return response()->json($result);
    }
    public function usersByInstitute(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_users'))
            return $err;

        $entityId = $request->query('entity_id');
        $type = $request->query('type'); // 'system' or 'subsystem'

        if (!$entityId || !$type) {
            return response()->json(['error' => 'Missing entity_id or type'], 400);
        }

        $instituteId = null;
        if ($type === 'system') {
            $instituteId = DB::table('systems')->where('id', $entityId)->value('institute_id');
        } elseif ($type === 'subsystem') {
            $instituteId = DB::table('subsystems as ss')
                ->join('systems as s', 'ss.system_id', '=', 's.id')
                ->where('ss.id', $entityId)
                ->value('s.institute_id');
        }

        if (!$instituteId) {
            return response()->json(['error' => 'Institute not found for this entity'], 404);
        }

        $users = DB::table('users as u')
            ->join('user_affilation as ua', 'u.user_id', '=', 'ua.user_id')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->where('ua.institute_id', $instituteId)
            ->where('ua.is_active', true)
            ->where('u.status', '!=', 'deactivated')
            ->select([
                'u.user_id as id',
                DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as name"),
                'u.email'
            ])
            ->orderBy('name')
            ->get();

        return response()->json($users);
    }
    public function userDetailsByEmail(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_users'))
            return $err;

        $email = $request->query('email');
        if (!$email)
            return response()->json(['error' => 'Email required'], 400);

        $user = DB::table('users as u')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->where('u.email', $email)
            ->select(['u.user_id', 'u.email', DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as name")])
            ->first();

        if (!$user)
            return response()->json(['error' => 'User not found'], 404);

        $affiliations = DB::table('user_affilation as ua')
            ->join('institutes as i', 'ua.institute_id', '=', 'i.id')
            ->leftJoin('categories as c', 'ua.category_id', '=', 'c.id')
            ->where('ua.user_id', $user->user_id)
            ->select(['i.name as institute_name', 'c.name as category_name'])
            ->get();

        $institutes = $affiliations->pluck('institute_name')->unique()->values();
        $categories = $affiliations->pluck('category_name')->filter()->unique()->values();

        return response()->json([
            'name' => $user->name,
            'email' => $user->email,
            'institutes' => $institutes,
            'category' => $categories->first() ?: 'N/A'
        ]);
    }

    // ════════════════════════════════════════════════════════════
    // WORKFLOW VERSIONING
    // ════════════════════════════════════════════════════════════

    /**
     * PUT /api/admin/workflows/{id}
     * Version-safe update: clones the workflow, applies changes, marks old as not-latest.
     */
    public function updateWorkflow(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_workflows'))
            return $err;

        $request->validate([
            'workflow_name' => 'sometimes|string|max:255',
            'workflow_description' => 'nullable|string',
            'steps' => 'required|array|min:1',
            'steps.*.role_id' => 'required|integer|exists:roles,id',
            'steps.*.step_no' => 'required|integer|min:1',
            'steps.*.step_action' => 'required|string|max:255',
            'steps.*.status_name' => 'required|string|max:255',
            'steps.*.is_final_step' => 'boolean',
        ]);

        $steps = collect($request->steps);

        // Validate sequential, unique step_no
        $stepNos = $steps->pluck('step_no')->sort()->values();
        for ($i = 0; $i < $stepNos->count(); $i++) {
            if ($stepNos[$i] !== $i + 1) {
                return response()->json(['error' => 'Step numbers must be sequential starting from 1.'], 422);
            }
        }
        if ($stepNos->count() !== $stepNos->unique()->count()) {
            return response()->json(['error' => 'Duplicate step_no values are not allowed.'], 422);
        }

        /** @var Workflow|null $oldWorkflow */
        $oldWorkflow = Workflow::with('steps')->find($id);
        if (!$oldWorkflow) {
            return response()->json(['error' => 'Workflow not found.'], 404);
        }

        DB::transaction(function () use ($oldWorkflow, $request, $steps) {
            // 1. Clone the workflow as a new version
            $newWorkflow = $oldWorkflow->cloneAsNewVersion();
            if ($request->filled('workflow_name')) {
                $newWorkflow->workflow_name = $request->workflow_name;
            }
            if ($request->has('workflow_description')) {
                $newWorkflow->workflow_description = $request->workflow_description;
            }
            $newWorkflow->save();

            // 2. Apply the submitted steps to the new workflow
            foreach ($steps as $stepData) {
                $newWorkflow->steps()->create([
                    'step_no' => $stepData['step_no'],
                    'role_id' => $stepData['role_id'],
                    'step_action' => $stepData['step_action'],
                    'status_name' => $stepData['status_name'],
                    'is_final_step' => $stepData['is_final_step'] ?? ($stepData['step_no'] === $steps->max('step_no')),
                    'is_active' => true,
                ]);
            }

            // 3. Mark old workflow as no longer latest and make it inactive
            $oldWorkflow->update(['is_latest' => false, 'is_active' => false]);
        });

        return response()->json(['message' => 'Workflow updated successfully. New version created.']);
    }

    /**
     * DELETE /api/admin/workflows/{id}
     * Soft-delete a workflow (sets is_active = false). Never deletes rows.
     */
    public function deleteWorkflow(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_workflows'))
            return $err;

        $workflow = Workflow::find($id);
        if (!$workflow) {
            return response()->json(['error' => 'Workflow not found.'], 404);
        }

        // Check if any active applications are using this workflow
        $activeCount = DB::table('applications')
            ->where('workflow_id', $id)
            ->whereNotIn('status', ['completed', 'declined'])
            ->count();

        if ($activeCount > 0) {
            return response()->json([
                'error' => "Cannot deactivate: {$activeCount} application(s) are currently in-progress on this workflow.",
            ], 422);
        }

        $workflow->update(['is_active' => false, 'is_latest' => false]);

        return response()->json(['message' => 'Workflow deactivated successfully.']);
    }

    /**
     * POST /api/admin/workflows/{id}/rollback
     * Rolls back to the previous version of this workflow.
     */
    public function rollbackWorkflow(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_workflows'))
            return $err;

        /** @var Workflow|null $current */
        $current = Workflow::find($id);
        if (!$current) {
            return response()->json(['error' => 'Workflow not found.'], 404);
        }

        if ($current->version <= 1) {
            return response()->json(['error' => 'No previous version to roll back to.'], 422);
        }

        $previous = Workflow::where('workflow_name', $current->workflow_name)
            ->where('version', $current->version - 1)
            ->first();

        if (!$previous) {
            return response()->json(['error' => 'Previous version not found.'], 404);
        }

        DB::transaction(function () use ($current, $previous) {
            $current->update(['is_latest' => false]);
            $previous->update(['is_latest' => true, 'is_active' => true]);
        });

        return response()->json(['message' => "Rolled back to version {$previous->version} successfully."]);
    }

    /**
     * POST /api/admin/workflows/{id}/map
     * Maps a workflow to a specific request type and user category.
     */
    public function mapWorkflow(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_workflows'))
            return $err;

        $request->validate([
            'request_id' => 'required|exists:requests,id',
            'category_ids' => 'required|array|min:1',
            'category_ids.*' => 'exists:categories,id',
        ]);

        $workflow = DB::table('workflows')->where('workflow_id', $id)->first();
        if (!$workflow) {
            return response()->json(['error' => 'Workflow not found.'], 404);
        }

        foreach ($request->category_ids as $catId) {
            DB::table('workflow_category_mappings')->updateOrInsert(
                [
                    'request_id' => $request->request_id,
                    'category_id' => $catId
                ],
                [
                    'workflow_id' => $id,
                    'updated_at' => now(),
                    // Only set created_at if it's a new record
                    'created_at' => DB::raw('COALESCE(created_at, NOW())')
                ]
            );
        }
        return response()->json(['message' => 'Workflow mapped successfully.']);
    }

    /**
     * GET /api/admin/workflows/{id}/mappings
     * Fetches existing mappings for a workflow.
     */
    public function getWorkflowMappings(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request, 'manage_workflows'))
            return $err;

        $mappings = DB::table('workflow_category_mappings')
            ->where('workflow_id', $id)
            ->get(['request_id', 'category_id']);

        return response()->json($mappings);
    }
}
