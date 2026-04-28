<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\Role;
use App\Models\User;
use App\Models\Permission;

class RolesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $allPermissions = Permission::pluck('id', 'slug')->toArray();

        $roles = [
            [
                'name' => 'Super Admin',
                'slug' => 'super_admin',
                'description' => 'Full system access',
                'level' => 100,
                'permissions' => array_keys($allPermissions) // All permissions
            ],
            [
                'name' => 'Project Execution Team Lead',
                'slug' => 'pet_lead',
                'description' => 'Multi-institute access',
                'level' => 90,
                'permissions' => ['view_users', 'assign_role', 'approve_request', 'view_all_reports', 'manage_systems']
            ],
            [
                'name' => 'LI Coordinator',
                'slug' => 'li_coordinator',
                'description' => 'Institute level access',
                'level' => 80,
                'permissions' => ['view_users', 'approve_request', 'view_org_reports', 'manage_systems']
            ],
            [
                'name' => 'System Lead',
                'slug' => 'system_lead',
                'description' => 'System level access',
                'level' => 70,
                'permissions' => ['approve_request', 'view_org_reports']
            ],
            [
                'name' => 'Sub-System Lead',
                'slug' => 'subsystem_lead',
                'description' => 'Sub-system level access',
                'level' => 50,
                'permissions' => ['approve_request']
            ],
            [
                'name' => 'Supervisor',
                'slug' => 'supervisor',
                'description' => 'Recommendation authority',
                'level' => 30,
                'permissions' => []
            ],
            [
                'name' => 'User',
                'slug' => 'user',
                'description' => 'Basic user access',
                'level' => 1,
                'permissions' => []
            ],
        ];

        foreach ($roles as $r) {
            $permissionSlugs = $r['permissions'];
            unset($r['permissions']);

            $role = Role::updateOrCreate(['slug' => $r['slug']], $r);

            // Collect the IDs for the slugs that actually exist in the DB
            $permissionIds = collect($permissionSlugs)
                ->map(fn($slug) => $allPermissions[$slug] ?? null)
                ->filter()
                ->values()
                ->toArray();

            // sync: replaces existing pivot rows cleanly, idempotent
            $role->permissions()->sync($permissionIds);
        }

        // Create Super Admin User
        User::where('email', 'superadmin@example.com')->delete();
        $superAdmin = User::create([
            'email' => 'superadmin@example.com',
            'status' => 'active', 
        ]);

        $superAdminRole = Role::where('slug', 'super_admin')->first();
        $superAdmin->roles()->attach($superAdminRole->id, ['is_active' => true]);
    }
}