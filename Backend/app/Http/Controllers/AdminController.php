<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class AdminController extends Controller
{
    // -------------------------------------------------------------------
    // Which roles can each actor assign?
    // Key = actor's role slug → Value = list of role slugs they can assign
    // -------------------------------------------------------------------
    private const ASSIGN_MATRIX = [
        'super_admin'    => ['super_admin', 'pet_lead', 'li_coordinator', 'system_lead', 'subsystem_lead', 'supervisor', 'user'],
        'pet_lead'       => ['li_coordinator', 'system_lead', 'subsystem_lead', 'user'],
        'li_coordinator' => ['system_lead', 'subsystem_lead', 'user'],
        'system_lead'    => ['subsystem_lead', 'user'],
    ];

    /** Get the currently authenticated user */
    private function actor(): User
    {
        return Auth::user();
    }

    /** Get all role slugs the current actor is allowed to assign */
    private function assignableRoleSlugs(): array
    {
        $actor = $this->actor();
        $actor->load('roles');

        $allowed = [];
        foreach ($actor->roles as $role) {
            $slugs = self::ASSIGN_MATRIX[$role->slug] ?? [];
            $allowed = array_merge($allowed, $slugs);
        }
        return array_unique($allowed);
    }

    // -------------------------------------------------------------------
    // LIST USERS
    // GET /api/admin/users?institute_id=&system_name=&search=&page=
    // -------------------------------------------------------------------
    public function listUsers(Request $request): JsonResponse
    {
        $actor = $this->actor();
        $actor->load('roles');
        $actorSlugs = $actor->roles->pluck('slug')->toArray();

        // Only authority roles can list users
        $authorityRoles = array_keys(self::ASSIGN_MATRIX);
        if (!array_intersect($actorSlugs, $authorityRoles)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $query = User::with(['roles', 'institute', 'registration'])
            ->when($request->institute_id, fn($q) => $q->where('institute_id', $request->institute_id))
            ->when($request->search, function ($q) use ($request) {
                $term = '%' . $request->search . '%';
                $q->where(function ($q2) use ($term) {
                    $q2->where('email', 'like', $term)
                       ->orWhere('username', 'like', $term);
                });
            })
            // Filter by role slug
            ->when($request->role_slug, function ($q) use ($request) {
                $q->whereHas('roles', fn($r) => $r->where('slug', $request->role_slug));
            })
            // Filter by system name (via role_user pivot → systems table)
            ->when($request->system_name, function ($q) use ($request) {
                $q->whereHas('roles', function ($r) use ($request) {
                    $r->whereHas('users', function ($ru) use ($request) {
                        $ru->whereExists(function ($sub) use ($request) {
                            $sub->from('role_user')
                                ->join('systems', 'role_user.system_id', '=', 'systems.id')
                                ->whereColumn('role_user.user_id', 'users.id')
                                ->where('systems.name', $request->system_name);
                        });
                    });
                });
            })
            // Filter by subsystem name
            ->when($request->sub_system_name, function ($q) use ($request) {
                $q->whereExists(function ($sub) use ($request) {
                    $sub->from('role_user')
                        ->join('sub_systems', 'role_user.sub_system_id', '=', 'sub_systems.id')
                        ->whereColumn('role_user.user_id', 'users.id')
                        ->where('sub_systems.name', $request->sub_system_name);
                });
            });

        // LI Coordinator: scoped to their own institute
        if (
            !in_array('super_admin', $actorSlugs) &&
            !in_array('pet_lead', $actorSlugs) &&
            in_array('li_coordinator', $actorSlugs)
        ) {
            $query->where('institute_id', $actor->institute_id);
        }

        $users = $query->orderBy('created_at', 'desc')->paginate(20);

        $systemNames = \App\Models\System::pluck('name', 'id');
        $subSystemNames = \App\Models\SubSystem::pluck('name', 'id');

        return response()->json([
            'data'         => $users->map(fn($u) => [
                'id'         => $u->id,
                'username'   => $u->username,
                'email'      => $u->email,
                'institute'  => $u->institute?->name,
                'institute_id'=> $u->institute_id,
                'roles'      => $u->roles->map(fn($r) => [
                    'id' => $r->id, 
                    'name' => $r->name, 
                    'slug' => $r->slug,
                    'system_name' => $r->pivot && $r->pivot->system_id ? $systemNames[$r->pivot->system_id] ?? null : null,
                    'sub_system_name' => $r->pivot && $r->pivot->sub_system_id ? $subSystemNames[$r->pivot->sub_system_id] ?? null : null,
                ]),
                'created_at' => $u->created_at?->format('Y-m-d'),
                'full_name'  => $u->registration
                    ? implode(' ', array_filter([$u->registration->prefix, $u->registration->first_name, $u->registration->last_name]))
                    : null,
            ]),
            'total'        => $users->total(),
            'current_page' => $users->currentPage(),
            'last_page'    => $users->lastPage(),
        ]);
    }

    // -------------------------------------------------------------------
    // LIST ASSIGNABLE ROLES (for the dropdown in the UI)
    // GET /api/admin/roles
    // -------------------------------------------------------------------
    public function listRoles(): JsonResponse
    {
        $slugs = $this->assignableRoleSlugs();
        if (empty($slugs)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $roles = Role::whereIn('slug', $slugs)->orderBy('level')->get(['id', 'name', 'slug', 'level', 'description']);
        return response()->json($roles);
    }

    // -------------------------------------------------------------------
    // LIST ALL ROLES (super admin only, for role management)
    // GET /api/admin/all-roles
    // -------------------------------------------------------------------
    public function allRoles(): JsonResponse
    {
        $actor = $this->actor();
        $actor->load('roles');
        if (!$actor->roles->contains('slug', 'super_admin')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $roles = Role::withCount('users')->orderBy('level')->get();
        return response()->json($roles);
    }

    // -------------------------------------------------------------------
    // ASSIGN ROLE TO USER
    // POST /api/admin/assign-role
    // Body: { user_id, role_id }
    // -------------------------------------------------------------------
    public function assignRole(Request $request): JsonResponse
    {
        $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'role_id' => 'required|integer|exists:roles,id',
            'system_id' => 'nullable|integer|exists:systems,id',
            'sub_system_id' => 'nullable|integer|exists:sub_systems,id',
        ]);

        $allowedSlugs = $this->assignableRoleSlugs();
        if (empty($allowedSlugs)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $role = Role::findOrFail($request->role_id);

        if (!in_array($role->slug, $allowedSlugs)) {
            return response()->json([
                'message' => "You do not have permission to assign the '{$role->name}' role."
            ], 403);
        }

        $targetUser = User::with('roles')->findOrFail($request->user_id);

        // Prevent assigning a role the user already has (unless we want to allow multiple of same role with different scopes)
        if ($targetUser->roles->contains('id', $role->id)) {
            return response()->json(['message' => 'User already has this role.'], 422);
        }

        $targetUser->roles()->attach($role->id, [
            'system_id' => $request->system_id,
            'sub_system_id' => $request->sub_system_id,
        ]);

        return response()->json([
            'message' => "Role '{$role->name}' assigned to {$targetUser->email}.",
            'user_id' => $targetUser->id,
            'role'    => ['id' => $role->id, 'name' => $role->name, 'slug' => $role->slug],
        ]);
    }

    // -------------------------------------------------------------------
    // REMOVE ROLE FROM USER
    // DELETE /api/admin/assign-role
    // Body: { user_id, role_id }
    // -------------------------------------------------------------------
    public function removeRole(Request $request): JsonResponse
    {
        $request->validate([
            'user_id' => 'required|integer|exists:users,id',
            'role_id' => 'required|integer|exists:roles,id',
        ]);

        $allowedSlugs = $this->assignableRoleSlugs();
        $role = Role::findOrFail($request->role_id);

        if (!in_array($role->slug, $allowedSlugs)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $targetUser = User::findOrFail($request->user_id);
        $targetUser->roles()->detach($role->id);

        return response()->json(['message' => "Role '{$role->name}' removed from {$targetUser->email}."]);
    }

    // -------------------------------------------------------------------
    // CREATE ROLE (super admin only)
    // POST /api/admin/roles
    // -------------------------------------------------------------------
    public function createRole(Request $request): JsonResponse
    {
        $actor = $this->actor();
        $actor->load('roles');
        if (!$actor->roles->contains('slug', 'super_admin')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'name'        => 'required|string|max:100|unique:roles,name',
            'slug'        => 'required|string|max:100|unique:roles,slug',
            'description' => 'nullable|string|max:255',
            'level'       => 'required|integer|min:1',
        ]);

        $role = Role::create($request->only(['name', 'slug', 'description', 'level']));

        return response()->json(['message' => 'Role created.', 'role' => $role], 201);
    }

    // -------------------------------------------------------------------
    // LIST INSTITUTES (for filter dropdown)
    // GET /api/admin/institutes
    // -------------------------------------------------------------------
    public function listInstitutes(): JsonResponse
    {
        $institutes = \App\Models\Institute::select('id', 'name')->orderBy('name')->get();
        return response()->json($institutes);
    }

    // -------------------------------------------------------------------
    // LIST SYSTEMS (for role assignment dropdown)
    // GET /api/admin/systems
    // -------------------------------------------------------------------
    public function listSystems(Request $request): JsonResponse
    {
        $query = \App\Models\System::select('id', 'name')->orderBy('name');
        
        if ($request->institute_id) {
            $query->whereHas('institutes', function($q) use ($request) {
                $q->where('institutes.id', $request->institute_id);
            });
        }
        
        $systems = $query->get();
        return response()->json($systems);
    }

    // -------------------------------------------------------------------
    // LIST SUB-SYSTEMS (for role assignment dropdown)
    // GET /api/admin/subsystems?system_id=
    // -------------------------------------------------------------------
    public function listSubsystems(Request $request): JsonResponse
    {
        $query = \App\Models\SubSystem::select('id', 'name', 'system_id')->orderBy('name');
        if ($request->system_id) {
            $query->where('system_id', $request->system_id);
        }
        return response()->json($query->get());
    }

    // -------------------------------------------------------------------
    // LIST ALL ACCESS REQUESTS (for authority roles)
    // GET /api/admin/requests?status=&institute_id=&page=
    // Escalation scope:
    //   system_lead   → sees requests for their system
    //   li_coordinator → sees requests for their institute
    //   pet_lead/super_admin → sees all
    // -------------------------------------------------------------------
    public function listRequests(Request $request): JsonResponse
    {
        $actor = $this->actor();
        $actor->load('roles');

        if (!$actor->roles->whereIn('slug', ['super_admin', 'pet_lead', 'li_coordinator', 'system_lead', 'subsystem_lead'])->count()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $actorSlugs = $actor->roles->pluck('slug')->toArray();

        $query = \App\Models\AccessRequest::with(['user.registration', 'institute'])
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->when($request->institute_id, fn($q) => $q->where('institute_id', $request->institute_id));

        // Scope by role
        if (in_array('super_admin', $actorSlugs) || in_array('pet_lead', $actorSlugs)) {
            // They see all requests; no extra filters needed here.
        } elseif (in_array('li_coordinator', $actorSlugs)) {
            // LI Coordinator sees all requests for their institute
            $query->where('institute_id', $actor->institute_id);
        } elseif (in_array('system_lead', $actorSlugs)) {
            // System lead sees requests for systems they lead located at their institute
            $ledSystems = \DB::table('role_user')
                ->where('user_id', $actor->id)
                ->whereNotNull('system_id')
                ->join('systems', 'role_user.system_id', '=', 'systems.id')
                ->pluck('systems.name')
                ->toArray();
                
            $query->where('institute_id', $actor->institute_id)
                  ->whereIn('system_name', $ledSystems);
        } elseif (in_array('subsystem_lead', $actorSlugs)) {
            // Subsystem lead sees requests for their subsystems located at their institute
            $ledSubSystems = \DB::table('role_user')
                ->where('user_id', $actor->id)
                ->whereNotNull('sub_system_id')
                ->join('sub_systems', 'role_user.sub_system_id', '=', 'sub_systems.id')
                ->pluck('sub_systems.name')
                ->toArray();
                
            $query->where('institute_id', $actor->institute_id)
                  ->whereIn('sub_system_name', $ledSubSystems);
        }

        $requests = $query->orderBy('created_at', 'desc')->paginate(20);

        return response()->json([
            'data'         => $requests->map(fn($r) => [
                'id'          => $r->id,
                'applicant'   => $r->user?->registration
                    ? implode(' ', array_filter([$r->user->registration->prefix, $r->user->registration->first_name, $r->user->registration->last_name]))
                    : $r->user?->email,
                'email'       => $r->user?->email,
                'system_name' => $r->system_name,
                'institute'   => $r->institute?->name,
                'services'    => $r->services,
                'start_date'  => $r->start_date,
                'end_date'    => $r->end_date,
                'status'      => $r->status ?? 'pending',
                'approved_by' => $r->approved_by,
                'created_at'  => $r->created_at?->format('Y-m-d'),
            ]),
            'total'        => $requests->total(),
            'current_page' => $requests->currentPage(),
            'last_page'    => $requests->lastPage(),
        ]);
    }

    // -------------------------------------------------------------------
    // APPROVE REQUEST
    // POST /api/admin/requests/{id}/approve
    // -------------------------------------------------------------------
    public function approveRequest(int $id): JsonResponse
    {
        $actor = $this->actor();
        $actor->load('roles');

        if (!$actor->roles->whereIn('slug', ['super_admin', 'pet_lead', 'li_coordinator', 'system_lead', 'subsystem_lead'])->count()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $req = \App\Models\AccessRequest::findOrFail($id);
        $req->status      = 'approved';
        $req->approved_by = $actor->email;
        $req->save();

        return response()->json(['message' => 'Request approved.', 'id' => $id, 'status' => 'approved', 'approved_by' => $actor->email]);
    }

    // -------------------------------------------------------------------
    // REJECT REQUEST
    // POST /api/admin/requests/{id}/reject
    // -------------------------------------------------------------------
    public function rejectRequest(Request $request, int $id): JsonResponse
    {
        $actor = $this->actor();
        $actor->load('roles');

        if (!$actor->roles->whereIn('slug', ['super_admin', 'pet_lead', 'li_coordinator', 'system_lead', 'subsystem_lead'])->count()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $req = \App\Models\AccessRequest::findOrFail($id);
        $req->status      = 'rejected';
        $req->approved_by = $actor->email;
        $req->save();

        return response()->json(['message' => 'Request rejected.', 'id' => $id, 'status' => 'rejected']);
    }
}

