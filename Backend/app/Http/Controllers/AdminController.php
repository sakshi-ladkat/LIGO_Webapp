<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class AdminController extends Controller
{
    // ── Guard: only super_admin may call these endpoints ─────────────────────
    private function checkAdmin(Request $request): ?JsonResponse
    {
        $userId = $request->auth_user_id;
        $isAdmin = DB::table('user_roles as ur')
            ->join('roles as r', 'ur.role_id', '=', 'r.id')
            ->where('ur.user_id', $userId)
            ->where('r.slug', 'super_admin')
            ->where('ur.is_active', true)
            ->exists();

        return $isAdmin ? null : response()->json(['error' => 'Forbidden'], 403);
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
        if ($err = $this->checkAdmin($request)) return $err;

        $apps = DB::table('applications as app')
            ->join('workflows as wf', 'app.workflow_id', '=', 'wf.workflow_id')
            ->join('requests as req', 'app.request_id', '=', 'req.id')
            ->join('users as u', 'app.user_id', '=', 'u.user_id')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->leftJoin('user_affilation as ua', 'u.user_id', '=', 'ua.user_id')
            ->leftJoin('institutes as i', 'ua.institute_id', '=', 'i.id')
            ->leftJoin('categories as cat', 'ua.category_id', '=', 'cat.id')
            ->leftJoin('workflow_steps as ws', 'app.current_step_id', '=', 'ws.workflow_step_id')
            ->leftJoin('users as approver', 'app.approved_by', '=', 'approver.user_id')
            ->leftJoin('user_profiles as ap', 'approver.user_id', '=', 'ap.user_id')
            ->select([
                'app.id',
                'app.application_id',
                'app.status',
                'app.ligo_member',
                'app.duration',
                'app.created_at as submitted_at',
                'app.approved_at',
                DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as applicant_name"),
                'u.email as applicant_email',
                'u.user_id as applicant_user_id',
                'i.name as institute_name',
                'cat.name as category_name',
                'wf.workflow_name',
                'req.name as request_name',
                'ws.status_name as current_status',
                DB::raw("COALESCE(CONCAT(ap.first_name, ' ', ap.last_name), approver.email) as approved_by_name"),
            ])
            ->orderByDesc('app.created_at')
            ->get();

        $stats = [
            'total'    => $apps->count(),
            'pending'  => $apps->where('status', 'pending')->count()
                        + $apps->whereNotIn('status', ['approved', 'rejected', 'pending'])->count(),
            'approved' => $apps->where('status', 'approved')->count(),
            'rejected' => $apps->where('status', 'rejected')->count(),
        ];

        return response()->json(['applications' => $apps, 'stats' => $stats]);
    }

    /**
     * GET /api/admin/applications/{id}/logs
     * Returns the full audit trail / tracking timeline for one application.
     */
    public function applicationLogs(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;

        $logs = DB::table('application_logs as al')
            ->join('users as u', 'al.action_by', '=', 'u.user_id')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->leftJoin('workflow_steps as ws', 'al.workflow_step_id', '=', 'ws.workflow_step_id')
            ->leftJoin('roles as r', 'ws.role_id', '=', 'r.id')
            ->where('al.application_id', $id)
            ->select([
                'al.id',
                'al.action',
                'al.remarks',
                'al.created_at as timestamp',
                DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as actor_name"),
                'r.name as role_name',
                'ws.status_name as step_name',
                'al.role as role_slug',
            ])
            ->orderBy('al.created_at')
            ->get();

        return response()->json($logs);
    }

    // ════════════════════════════════════════════════════════════
    // INSTITUTES
    // ════════════════════════════════════════════════════════════

    /**
     * GET /api/admin/institutes
     * Returns both active and pending institutes.
     */
    public function institutes(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;

        $active  = DB::table('institutes')->where('is_active', true)->orderBy('name')->get();
        $pending = DB::table('institutes')->where('is_active', false)->orderBy('created_at', 'desc')->get();

        return response()->json(['active' => $active, 'pending' => $pending]);
    }

    /**
     * POST /api/admin/institutes
     * Directly register & approve a new institute (is_active = true).
     */
    public function createInstitute(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;

        $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:10|unique:institutes,code',
        ]);

        $id = DB::table('institutes')->insertGetId([
            'name'       => $request->name,
            'code'       => strtoupper($request->code),
            'is_active'  => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'Institute registered and approved.', 'id' => $id], 201);
    }

    /**
     * PATCH /api/admin/institutes/{id}/approve
     * Approves a pending institute (sets is_active = true).
     */
    public function approveInstitute(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;

        $updated = DB::table('institutes')->where('id', $id)->update([
            'is_active'  => true,
            'updated_at' => now(),
        ]);

        if (!$updated) {
            return response()->json(['error' => 'Institute not found.'], 404);
        }

        return response()->json(['message' => 'Institute approved.']);
    }

    /**
     * DELETE /api/admin/institutes/{id}
     * Deletes / rejects a pending institute.
     */
    public function deleteInstitute(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;

        DB::table('institutes')->where('id', $id)->delete();
        return response()->json(['message' => 'Institute removed.']);
    }

    /**
     * PATCH /api/admin/institutes/{id}
     * Edits institute name / code.
     */
    public function updateInstitute(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'code' => 'sometimes|string|max:10',
        ]);

        DB::table('institutes')->where('id', $id)->update(array_filter([
            'name'       => $request->name,
            'code'       => $request->code ? strtoupper($request->code) : null,
            'updated_at' => now(),
        ]));

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
        if ($err = $this->checkAdmin($request)) return $err;
        $roles = DB::table('roles')->orderBy('name')->get(['id', 'name', 'slug']);
        return response()->json($roles);
    }

    /**
     * POST /api/admin/users/assign-role
     * Assign a role to a user (matched by email).
     */
    public function assignRole(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;

        $request->validate([
            'email'   => 'required|email|exists:users,email',
            'role_id' => 'required|exists:roles,id',
        ]);

        $user = DB::table('users')->where('email', $request->email)->first();
        if (!$user) {
            return response()->json(['error' => 'User not found.'], 404);
        }

        DB::table('user_roles')->updateOrInsert(
            ['user_id' => $user->user_id, 'role_id' => $request->role_id],
            ['is_active' => true, 'updated_at' => now(), 'created_at' => now()]
        );

        return response()->json(['message' => 'Role assigned successfully.']);
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
        if ($err = $this->checkAdmin($request)) return $err;

        $data = match($entity) {
            'categories'  => DB::table('categories')->orderBy('name')->get(),
            'roles'       => DB::table('roles')->orderBy('name')->get(),
            'services'    => DB::table('services')->orderBy('name')->get(),
            'subservices' => DB::table('subservices')->orderBy('name')->get(),
            'requests'    => DB::table('requests')->orderBy('name')->get(),
            'workflows'   => DB::table('workflows')->orderBy('workflow_name')->get(),
            'systems'     => DB::table('systems')->orderBy('name')->get(),
            'subsystems'  => DB::table('subsystems')->orderBy('name')->get(),
            'institutes'  => DB::table('institutes')->orderBy('name')->get(),
            'users'       => DB::table('users as u')
                ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                ->select([
                    'u.user_id as id',
                    'u.email',
                    'u.status',
                    DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as name"),
                ])
                ->orderBy('u.created_at', 'desc')
                ->limit(200)
                ->get(),
            default       => null,
        };

        if ($data === null) {
            return response()->json(['error' => 'Unknown entity.'], 400);
        }

        return response()->json($data);
    }

    /**
     * GET /api/admin/workflows-full
     * Returns all workflows with their ordered steps and role info.
     */
    public function workflowsWithSteps(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;

        $workflows = DB::table('workflows')->orderBy('workflow_name')->get();

        $result = $workflows->map(function ($wf) {
            $steps = DB::table('workflow_steps as ws')
                ->leftJoin('roles as r', 'ws.role_id', '=', 'r.id')
                ->where('ws.workflow_id', $wf->workflow_id)
                ->orderBy('ws.step_order')
                ->select([
                    'ws.workflow_step_id',
                    'ws.step_order',
                    'ws.status_name',
                    'ws.is_final_step',
                    'r.name as role_name',
                    'r.slug as role_slug',
                ])
                ->get();

            return array_merge((array) $wf, ['steps' => $steps]);
        });

        return response()->json($result);
    }
}
