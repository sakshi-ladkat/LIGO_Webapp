<?php

namespace App\Http\Controllers;

use App\Models\User;
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

        $appsQuery = DB::table('applications as app')
            ->join('workflows as wf', 'app.workflow_id', '=', 'wf.workflow_id')
            ->join('requests as req', 'app.request_id', '=', 'req.id')
            ->join('users as u', 'app.user_id', '=', 'u.user_id')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->leftJoin('user_affilation as ua', 'u.user_id', '=', 'ua.user_id')
            ->leftJoin('institutes as i', 'ua.institute_id', '=', 'i.id')
            ->leftJoin('categories as cat', 'ua.category_id', '=', 'cat.id')
            ->leftJoin('workflow_steps as ws', 'app.current_step_id', '=', 'ws.workflow_step_id');

        $apps = $appsQuery
            ->select([
                'app.id',
                'app.application_id',
                'app.status',
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
                'ws.status_name as current_status',
                DB::raw('NULL as approved_by_name'),
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

    /**
     * GET /api/admin/applications/{id}/tracker
     * Returns the full workflow timeline (all steps) for an application.
     */
    public function applicationTracker(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;

        $app = DB::table('applications as app')
            ->join('workflows as wf', 'app.workflow_id', '=', 'wf.workflow_id')
            ->join('requests as req', 'app.request_id', '=', 'req.id')
            ->leftJoin('workflow_steps as ws', 'app.current_step_id', '=', 'ws.workflow_step_id')
            ->where('app.id', $id)
            ->select([
                'app.id',
                'app.application_id',
                'app.current_step_id',
                'app.status',
                'app.created_at as submitted_at',
                'app.workflow_id',
                'wf.workflow_name',
                'req.name as request_name',
                'ws.status_name as current_status',
                'ws.step_no as current_step_no',
            ])
            ->first();

        if (!$app) {
            return response()->json(['error' => 'Application not found'], 404);
        }

        $steps = DB::table('workflow_steps')
            ->where('workflow_id', $app->workflow_id)
            ->orderBy('step_no')
            ->get(['workflow_step_id', 'step_no', 'status_name', 'step_action']);

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
            $approval = $approvals->has($step->workflow_step_id) ? (object)$approvals->get($step->workflow_step_id) : null;
            $step->approved_by_name = $approval ? $approval->approved_by_name : null;
            $step->approved_at = $approval ? $approval->approved_at : null;
            return $step;
        });

        return response()->json([
            'application' => $app,
            'steps' => $mappedSteps,
        ]);
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

        $active  = DB::table('institutes')->whereIn('status', ['active', 'inactive'])->orderBy('name')->get();
        $pending = DB::table('institutes')->where('status', 'pending')->orderBy('created_at', 'desc')->get();

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
            'city'       => $request->city,
            'status'     => 'active',
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

        $inst = DB::table('institutes')->where('id', $id)->first();
        if (!$inst) return response()->json(['error' => 'Not found'], 404);

        $data = [
            'status'     => 'active',
            'is_active'  => true,
            'updated_at' => now(),
        ];

        // Allow overriding fields during approval
        if ($request->has('name')) $data['name'] = $request->name;
        if ($request->has('code')) $data['code'] = strtoupper($request->code);
        if ($request->has('city')) $data['city'] = $request->city;

        DB::table('institutes')->where('id', $id)->update($data);

        return response()->json(['message' => 'Institute approved and activated.']);
    }

    /**
     * PATCH /api/admin/institutes/{id}/toggle-status
     */
    public function toggleInstituteStatus(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;

        $inst = DB::table('institutes')->where('id', $id)->first();
        if (!$inst) return response()->json(['error' => 'Not found'], 404);

        $newStatus = ($inst->status === 'active') ? 'inactive' : 'active';
        
        DB::table('institutes')->where('id', $id)->update([
            'status'    => $newStatus,
            'is_active' => ($newStatus === 'active'),
            'updated_at'=> now(),
        ]);

        return response()->json(['message' => 'Status updated', 'status' => $newStatus]);
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

        // ── Assign Role ──
        DB::table('user_roles')->updateOrInsert(
            ['user_id' => $user->user_id, 'role_id' => $request->role_id],
            ['is_active' => true, 'updated_at' => now(), 'created_at' => now()]
        );

        // ── Optional: Sync affiliation if provided ──
        if ($request->has('institute_id') && $request->has('category_id')) {
            DB::table('user_affilation')->updateOrInsert(
                ['user_id' => $user->user_id],
                [
                    'institute_id' => $request->institute_id,
                    'category_id'  => $request->category_id,
                    'is_active'    => true,
                    'updated_at'   => now()
                ]
            );
        }

        return response()->json(['message' => 'Role and affiliation updated successfully.']);
    }

    /**
     * POST /api/admin/roles
     */
    public function storeRole(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;
        $request->validate(['name' => 'required|string|unique:roles,name', 'slug' => 'required|string|unique:roles,slug']);
        
        $id = DB::table('roles')->insertGetId([
            'name' => $request->name,
            'slug' => $request->slug,
            'created_at' => now(), 'updated_at' => now()
        ]);
        return response()->json(['message' => 'Role created', 'id' => $id]);
    }

    /**
     * PATCH /api/admin/roles/{id}
     */
    public function updateRole(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;
        DB::table('roles')->where('id', $id)->update(array_filter([
            'name' => $request->name,
            'slug' => $request->slug,
            'updated_at' => now()
        ]));
        return response()->json(['message' => 'Role updated']);
    }

    /**
     * POST /api/admin/categories
     */
    public function storeCategory(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;
        $request->validate([
            'name'      => 'required|string',
            'parent_id' => 'nullable|exists:categories,id',
            'slug'      => 'required|string|unique:categories,slug'
        ]);

        $id = DB::table('categories')->insertGetId([
            'name'       => $request->name,
            'parent_id'  => $request->parent_id,
            'slug'       => $request->slug,
            'is_active'  => true,
            'created_at' => now(), 'updated_at' => now()
        ]);
        return response()->json(['message' => 'Category created', 'id' => $id]);
    }

    /**
     * PATCH /api/admin/categories/{id}/toggle
     */
    public function toggleCategoryStatus(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;
        $cat = DB::table('categories')->where('id', $id)->first();
        if (!$cat) return response()->json(['error' => 'Not found'], 404);

        DB::table('categories')->where('id', $id)->update([
            'is_active'  => !$cat->is_active,
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
        if ($err = $this->checkAdmin($request)) return $err;

        $data = match($entity) {
            'categories'  => DB::table('categories as c')
                ->leftJoin('categories as p', 'c.parent_id', '=', 'p.id')
                ->select(['c.*', 'p.name as parent_name'])
                ->orderBy('c.name')
                ->get(),
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
                ->leftJoin('user_roles as ur', 'u.user_id', '=', 'ur.user_id')
                ->leftJoin('roles as r', 'ur.role_id', '=', 'r.id')
                ->when($request->role_id, function($q) use ($request) {
                    return $q->where('ur.role_id', $request->role_id);
                })
                ->select([
                    'u.user_id as id',
                    'u.email',
                    'u.status',
                    DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as name"),
                    'r.name as role_name'
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
                ->orderBy('ws.step_no')
                ->select([
                    'ws.workflow_step_id',
                    'ws.step_no',
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
