<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Role;
use App\Models\Permission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class AdminController extends Controller
{
    /**
     * Get all users with roles
     */
    public function getUsers(Request $request)
    {
        if (!$this->isSuperAdmin($request)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $users = User::with('roles')->get();
        return response()->json(['users' => $users], 200);
    }

    /**
     * Get all roles with permissions
     */
    public function getRoles(Request $request)
    {
        if (!$this->isSuperAdmin($request)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $roles = Role::with('permissions')->get();
        return response()->json(['roles' => $roles], 200);
    }

    /**
     * Get all permissions
     */
    public function getPermissions(Request $request)
    {
        if (!$this->isSuperAdmin($request)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $permissions = Permission::all()->groupBy('category');
        return response()->json(['permissions' => $permissions], 200);
    }

    /**
     * Create or Update a role
     */
    public function saveRole(Request $request)
    {
        if (!$this->isSuperAdmin($request)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'name' => 'required|string',
            'slug' => 'required|string',
            'level' => 'required|integer',
            'permissions' => 'array'
        ]);

        $role = Role::updateOrCreate(
            ['slug' => $request->slug],
            [
                'name' => $request->name,
                'description' => $request->description,
                'level' => $request->level
            ]
        );

        if ($request->has('permissions')) {
            $role->permissions()->sync($request->permissions);
        }

        return response()->json(['message' => 'Role saved successfully', 'role' => $role], 200);
    }

    /**
     * Assign roles to a user
     */
    public function assignRoles(Request $request)
    {
        if (!$this->isSuperAdmin($request)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'user_id' => 'required|exists:users,id',
            'roles' => 'required|array',
            'roles.*.id' => 'required|exists:roles,id',
            'roles.*.institute_id' => 'nullable|integer',
            'roles.*.department_id' => 'nullable|integer',
            'roles.*.sub_department_id' => 'nullable|integer',
        ]);

        $user = User::findOrFail($request->user_id);
        
        $syncData = [];
        foreach ($request->roles as $roleData) {
            $syncData[$roleData['id']] = [
                'institute_id' => $roleData['institute_id'] ?? null,
                'department_id' => $roleData['department_id'] ?? null,
                'sub_department_id' => $roleData['sub_department_id'] ?? null,
            ];
        }

        $user->roles()->sync($syncData);

        return response()->json(['message' => 'Roles assigned successfully'], 200);
    }

    /**
     * Helper to check if the requesting user is a Super Admin
     */
    private function isSuperAdmin(Request $request)
    {
        $token = $request->bearerToken() ?? $request->input('token');
        if (!$token) return false;

        $userId = Cache::get('auth_token:' . $token);
        if (!$userId) return false;

        $user = User::find($userId);
        return $user && $user->isSuperAdmin();
    }
}
