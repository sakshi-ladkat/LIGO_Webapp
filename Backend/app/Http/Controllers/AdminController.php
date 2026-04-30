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
            ->where('workflow_id', ((object)$app)->workflow_id)
            ->orderBy('step_no')
            ->get(['workflow_step_id', 'step_no', 'status_name', 'step_action']);

        $approvals = DB::table('application_approvals as aa')
            ->join('users as u', 'aa.approved_by', '=', 'u.user_id')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->where('aa.application_id', ((object)$app)->id)
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

        $active  = DB::table('institutes')->whereIn('status', ['approved', 'inactive'])->orderBy('name')->get();
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
            'status'     => 'approved',
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
            'status'     => 'approved',
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

        $newStatus = ($inst->status === 'approved') ? 'inactive' : 'approved';
        
        DB::table('institutes')->where('id', $id)->update([
            'status'    => $newStatus,
            'is_active' => ($newStatus === 'approved'),
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
        $roles = DB::table('roles')->orderBy('level', 'desc')->orderBy('name')->get();
        
        foreach ($roles as $role) {
            $role->permissions = DB::table('roles_permissions as rp')
                ->join('permissions as p', 'rp.permission_id', '=', 'p.id')
                ->where('rp.role_id', $role->id)
                ->where('rp.is_active', true)
                ->select(['p.name', 'p.type', 'p.slug'])
                ->get();
        }

        return response()->json($roles);
    }

    /**
     * PATCH /api/auth/admin/roles/{id}/toggle
     */
    public function toggleRole(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;
        
        $role = DB::table('roles')->where('id', $id)->first();
        if (!$role) return response()->json(['error' => 'Role not found'], 404);

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
        if ($err = $this->checkAdmin($request)) return $err;
        $permissions = DB::table('permissions')->orderBy('type')->orderBy('name')->get();
        return response()->json($permissions);
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
            'entity_type' => 'nullable|string|in:system,subsystem',
            'entity_id'   => 'nullable|integer',
        ]);

        $user = DB::table('users')->where('email', $request->email)->first();
        if (!$user) {
            return response()->json(['error' => 'User not found.'], 404);
        }

        $role = DB::table('roles')->where('id', $request->role_id)->first();

        DB::beginTransaction();
        try {
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

            // ── Optional: Sync Entity Lead if role is a lead role ──
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
                    'entity_id'   => $request->entity_id,
                    'user_id'     => $user->user_id,
                    'is_active'   => true,
                    'assigned_at' => now(),
                    'created_at'  => now(),
                    'updated_at'  => now()
                ]);
            }

            DB::commit();
            return response()->json(['message' => 'Role and affiliation updated successfully.']);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => 'Failed to update: ' . $e->getMessage()], 500);
        }
    }

    /**
     * POST /api/admin/roles
     */
    public function storeRole(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;
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
                'created_at' => now(), 'updated_at' => now()
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

    public function toggleCategoryStatus(Request $request, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;
        $cat = DB::table('categories')->where('id', $id)->first();
        if (!$cat) return response()->json(['error' => 'Category not found'], 404);

        DB::table('categories')->where('id', $id)->update([
            'is_active'  => !((object)$cat)->is_active,
            'updated_at' => now()
        ]);
        return response()->json(['message' => 'Status updated']);
    }

    public function storeService(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;
        $request->validate([
            'name'         => 'required|string',
            'code'         => 'required|string|unique:services,code',
            'subsystem_id' => 'required|exists:subsystems,id',
            'type'         => 'nullable|string',
            'description'  => 'nullable|string'
        ]);

        $id = DB::table('services')->insertGetId([
            'name'         => $request->name,
            'code'         => $request->code,
            'subsystem_id' => $request->subsystem_id,
            'type'         => $request->type ?? 'General',
            'description'  => $request->description,
            'is_active'    => true,
            'created_at'   => now(), 'updated_at' => now()
        ]);
        return response()->json(['message' => 'Service created', 'id' => $id]);
    }

    public function storeSubservice(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;
        $request->validate([
            'name'       => 'required|string',
            'code'       => 'required|string|unique:subservices,code',
            'service_id' => 'required|exists:services,id',
            'type'       => 'nullable|string',
            'description'=> 'nullable|string'
        ]);

        $id = DB::table('subservices')->insertGetId([
            'name'       => $request->name,
            'code'       => $request->code,
            'service_id' => $request->service_id,
            'type'       => $request->type ?? 'General',
            'description'=> $request->description,
            'is_active'  => true,
            'created_at' => now(), 'updated_at' => now()
        ]);
        return response()->json(['message' => 'Sub-service created', 'id' => $id]);
    }

    public function storeSystem(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;
        $request->validate([
            'name'        => 'required|string',
            'code'        => 'required|string|unique:systems,code',
            'type'        => 'required|string',
            'description' => 'nullable|string',
            'institute_id'=> 'required|exists:institutes,id',
            'lead_id'     => 'required|exists:users,user_id',
        ]);

        DB::beginTransaction();
        try {
            $id = DB::table('systems')->insertGetId([
                'name'           => $request->name,
                'code'           => $request->code,
                'type'           => $request->type,
                'description'    => $request->description,
                'institute_id'   => $request->institute_id,
                'is_active'      => true,
                'created_at'     => now(), 'updated_at' => now()
            ]);

            DB::table('entity_assignments')->insert([
                'entity_type' => 'system',
                'entity_id'   => $id,
                'user_id'     => $request->lead_id,
                'is_active'   => true,
                'assigned_at' => now(),
                'created_at'  => now(), 'updated_at' => now()
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
        if ($err = $this->checkAdmin($request)) return $err;
        $request->validate([
            'name'        => 'required|string',
            'code'        => 'required|string|unique:subsystems,code',
            'type'        => 'required|string',
            'system_id'   => 'required|exists:systems,id',
            'lead_id'     => 'required|exists:users,user_id',
            'description' => 'nullable|string',
        ]);

        DB::beginTransaction();
        try {
            $id = DB::table('subsystems')->insertGetId([
                'name'              => $request->name,
                'code'              => $request->code,
                'type'              => $request->type,
                'system_id'         => $request->system_id,
                'is_active'         => true,
                'created_at'        => now(), 'updated_at' => now()
            ]);

            DB::table('entity_assignments')->insert([
                'entity_type' => 'subsystem',
                'entity_id'   => $id,
                'user_id'     => $request->lead_id,
                'is_active'   => true,
                'assigned_at' => now(),
                'created_at'  => now(), 'updated_at' => now()
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
        if ($err = $this->checkAdmin($request)) return $err;
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
                'entity_id'   => $id,
                'user_id'     => $request->user_id,
                'is_active'   => true,
                'assigned_at' => now(),
                'created_at'  => now(), 'updated_at' => now()
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
        if ($err = $this->checkAdmin($request)) return $err;
        $request->validate(['name' => 'required|string']);

        $table = match($entity) {
            'titles'    => 'titles',
            'durations' => 'durations',
            'requests'  => 'requests',
            default     => null
        };
        if (!$table) return response()->json(['error' => 'Invalid entity'], 400);

        $id = DB::table($table)->insertGetId([
            'name'       => $request->name,
            'is_active'  => true,
            'created_at' => now(), 'updated_at' => now()
        ]);
        return response()->json(['message' => ucfirst($entity) . ' created', 'id' => $id]);
    }

    /**
     * POST /api/admin/workflows
     */
    public function storeWorkflow(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;
        $request->validate(['name' => 'required|string']);

        $id = DB::table('workflows')->insertGetId([
            'workflow_name' => $request->name,
            'workflow_description' => $request->description ?? '',
            'is_active' => true,
            'created_at' => now(), 'updated_at' => now()
        ]);
        return response()->json(['message' => 'Workflow created', 'id' => $id]);
    }

    /**
     * POST /api/admin/workflow-steps
     */
    public function storeWorkflowStep(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;
        $request->validate([
            'workflow_id' => 'required|integer',
            'role_id'     => 'required|integer',
            'step_action' => 'required|string',
            'status_name' => 'required|string'
        ]);

        $maxStep = DB::table('workflow_steps')
            ->where('workflow_id', $request->workflow_id)
            ->max('step_no') ?? 0;

        $id = DB::table('workflow_steps')->insertGetId([
            'workflow_id' => $request->workflow_id,
            'step_no'     => $maxStep + 1,
            'role_id'     => $request->role_id,
            'step_action' => $request->step_action,
            'status_name' => $request->status_name,
            'is_active'   => true,
            'created_at'  => now(), 'updated_at' => now()
        ]);
        return response()->json(['message' => 'Workflow step added', 'id' => $id]);
    }

    /**
     * PATCH /api/admin/data/{entity}/{id}/toggle
     */
    public function toggleSimpleEntityStatus(Request $request, string $entity, int $id): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;
        
        $table = match($entity) {
            'titles'         => 'titles',
            'durations'      => 'durations',
            'requests'       => 'requests',
            'services'       => 'services',
            'subservices'    => 'subservices',
            'systems'        => 'systems',
            'subsystems'     => 'subsystems',
            'categories'     => 'categories',
            'workflows'      => 'workflows',
            'workflow-steps' => 'workflow_steps',
            default          => null
        };
        if (!$table) return response()->json(['error' => 'Invalid entity'], 400);

        $pk = match($entity) {
            'workflows'      => 'workflow_id',
            'workflow-steps' => 'workflow_step_id',
            default          => 'id'
        };

        $row = DB::table($table)->where($pk, $id)->first();
        if (!$row) return response()->json(['error' => 'Not found'], 404);

        DB::table($table)->where($pk, $id)->update([
            'is_active'  => !$row->is_active,
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
            'services'    => DB::table('services')->orderBy('name')->get()->map(function($s) {
                $s->children = DB::table('subservices')->where('service_id', $s->id)->orderBy('name')->get();
                return $s;
            }),
            'systems'     => DB::table('systems as s')
                ->leftJoin('entity_assignments as ea', function($join) {
                    $join->on('s.id', '=', 'ea.entity_id')->where('ea.entity_type', 'system')->where('ea.is_active', true);
                })
                ->leftJoin('users as u', 'ea.user_id', '=', 'u.user_id')
                ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                ->when($request->institute_id, fn($q) => $q->where('s.institute_id', $request->institute_id))
                ->select(['s.*', DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as lead_name"), 'ea.user_id as lead_user_id'])
                ->orderBy('s.name')
                ->get()
                ->map(function($s) {
                    $s->children = DB::table('subsystems as ss')
                        ->leftJoin('entity_assignments as ea', function($join) {
                            $join->on('ss.id', '=', 'ea.entity_id')->where('ea.entity_type', 'subsystem')->where('ea.is_active', true);
                        })
                        ->leftJoin('users as u', 'ea.user_id', '=', 'u.user_id')
                        ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                        ->where('ss.system_id', $s->id)
                        ->select(['ss.*', DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as lead_name"), 'ea.user_id as lead_user_id'])
                        ->orderBy('ss.name')
                        ->get();
                    return $s;
                }),
            'subservices' => DB::table('subservices')->select(['*', 'name'])->orderBy('name')->get(),
            'requests'    => DB::table('requests')->select(['*', 'name'])->orderBy('name')->get(),
            'workflows'   => DB::table('workflows')->orderBy('workflow_name')->get()->map(function($wf) {
                $wf->id = $wf->workflow_id;
                $wf->name = $wf->workflow_name;
                $wf->children = DB::table('workflow_steps as ws')
                    ->leftJoin('roles as r', 'ws.role_id', '=', 'r.id')
                    ->where('ws.workflow_id', $wf->workflow_id)
                    ->select(['ws.*', 'ws.workflow_step_id as id', 'ws.status_name as name', 'r.name as role_name'])
                    ->orderBy('ws.step_no')
                    ->get();
                return $wf;
            }),
            'subsystems'  => DB::table('subsystems as ss')
                ->join('systems as s', 'ss.system_id', '=', 's.id')
                ->leftJoin('entity_assignments as ea', function($join) {
                    $join->on('ss.id', '=', 'ea.entity_id')->where('ea.entity_type', 'subsystem')->where('ea.is_active', true);
                })
                ->leftJoin('users as u', 'ea.user_id', '=', 'u.user_id')
                ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                ->when($request->institute_id, fn($q) => $q->where('s.institute_id', $request->institute_id))
                ->select(['ss.*', 's.name as system_name', DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as lead_name"), 'ea.user_id as lead_user_id'])
                ->orderBy('ss.name')
                ->get(),
            'institutes'  => DB::table('institutes')->select(['*', 'name'])->orderBy('name')->get(),
            'titles'      => DB::table('titles')->select(['*', 'name'])->orderBy('name')->get(),
            'durations'   => DB::table('durations')->select(['*', 'name'])->get(),
            'users'       => DB::table('users as u')
                ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
                ->leftJoin('user_roles as ur', 'u.user_id', '=', 'ur.user_id')
                ->leftJoin('roles as r', 'ur.role_id', '=', 'r.id')
                ->leftJoin('user_affilation as ua', 'u.user_id', '=', 'ua.user_id')
                ->leftJoin('institutes as i', 'ua.institute_id', '=', 'i.id')
                ->when($request->role_id, function($q) use ($request) {
                    return $q->where('ur.role_id', $request->role_id);
                })
                ->when($request->institute_id, function($q) use ($request) {
                    return $q->where('ua.institute_id', $request->institute_id);
                })
                ->select([
                    'u.user_id as id',
                    'u.email',
                    'u.status',
                    DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as name"),
                    'r.name as role_name',
                    'i.name as institute_name'
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
     * GET /api/admin/users/details?identifier=...
     * Returns detailed user affiliation, role, and category.
     */
    public function userDetails(Request $request): JsonResponse
    {
        if ($err = $this->checkAdmin($request)) return $err;

        $id = $request->query('identifier');
        if (!$id) return response()->json(['error' => 'Identifier required'], 400);

        $u = DB::table('users as u')
            ->leftJoin('user_roles as ur', 'u.user_id', '=', 'ur.user_id')
            ->leftJoin('user_affilation as ua', 'u.user_id', '=', 'ua.user_id')
            ->where('u.user_id', $id)
            ->orWhere('u.email', $id)
            ->select([
                'u.user_id',
                'u.email',
                'ur.role_id',
                'ua.institute_id',
                'ua.category_id',
                'ua.entity_id'
            ])
            ->first();

        if (!$u) return response()->json(['error' => 'User not found'], 404);

        return response()->json($u);
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
