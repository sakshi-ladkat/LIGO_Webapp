<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;
use App\Models\Permission;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class RBACSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Truncate tables to prevent duplicates
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        Permission::truncate();
        Role::truncate();
        DB::table('permission_role')->truncate();
        DB::table('role_user')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        // 1. Create Permissions
        $permissions = [
            // User Management
            ['name' => 'Create User', 'slug' => 'create_user', 'category' => 'User Management'],
            ['name' => 'Edit User', 'slug' => 'edit_user', 'category' => 'User Management'],
            ['name' => 'Delete User', 'slug' => 'delete_user', 'category' => 'User Management'],
            ['name' => 'View Users', 'slug' => 'view_users', 'category' => 'User Management'],
            ['name' => 'Assign Role', 'slug' => 'assign_role', 'category' => 'User Management'],
            
            // Role Management
            ['name' => 'Create Role', 'slug' => 'create_role', 'category' => 'Role Management'],
            ['name' => 'Edit Role', 'slug' => 'edit_role', 'category' => 'Role Management'],
            ['name' => 'Delete Role', 'slug' => 'delete_role', 'category' => 'Role Management'],
            
            // Approval Management
            ['name' => 'Approve Request', 'slug' => 'approve_request', 'category' => 'Approvals'],
            ['name' => 'Reject Request', 'slug' => 'reject_request', 'category' => 'Approvals'],
            ['name' => 'Override Approval', 'slug' => 'override_approval', 'category' => 'Approvals'],
            
            // Report Management
            ['name' => 'View All Reports', 'slug' => 'view_all_reports', 'category' => 'Reports'],
            ['name' => 'View Organization Reports', 'slug' => 'view_org_reports', 'category' => 'Reports'],
            
            // System Management
            ['name' => 'Manage Systems', 'slug' => 'manage_systems', 'category' => 'System'],
            ['name' => 'Manage Subsystems', 'slug' => 'manage_subsystems', 'category' => 'System'],
        ];

        $permissionModels = [];
        foreach ($permissions as $p) {
            $permissionModels[$p['slug']] = Permission::create($p);
        }

        // 2. Create Roles
        $roles = [
            [
                'name' => 'Super Admin',
                'slug' => 'super_admin',
                'description' => 'Full system access',
                'level' => 1,
                'permissions' => array_keys($permissionModels) // All permissions
            ],
            [
                'name' => 'Project Execution Team Lead',
                'slug' => 'pet_lead',
                'description' => 'Multi-institute access',
                'level' => 2,
                'permissions' => ['view_users', 'assign_role', 'approve_request', 'view_all_reports', 'manage_systems']
            ],
            [
                'name' => 'LI Coordinator',
                'slug' => 'li_coordinator',
                'description' => 'Institute level access',
                'level' => 3,
                'permissions' => ['view_users', 'approve_request', 'view_org_reports', 'manage_systems']
            ],
            [
                'name' => 'System Lead',
                'slug' => 'system_lead',
                'description' => 'System level access',
                'level' => 4,
                'permissions' => ['approve_request', 'view_org_reports']
            ],
            [
                'name' => 'Sub-System Lead',
                'slug' => 'subsystem_lead',
                'description' => 'Sub-system level access',
                'level' => 5,
                'permissions' => ['approve_request']
            ],
            [
                'name' => 'Supervisor',
                'slug' => 'supervisor',
                'description' => 'Recommendation authority',
                'level' => 6,
                'permissions' => []
            ],
            [
                'name' => 'User',
                'slug' => 'user',
                'description' => 'Basic user access',
                'level' => 7,
                'permissions' => []
            ],
        ];

        foreach ($roles as $r) {
            $permissionsToAttach = $r['permissions'];
            unset($r['permissions']);
            
            $role = Role::create($r);
            
            foreach ($permissionsToAttach as $pSlug) {
                $role->permissions()->attach($permissionModels[$pSlug]->id);
            }
        }

        // 3. Create Super Admin User
        User::where('username', 'superadmin')->delete();
        $superAdmin = User::create([
            'username' => 'superadmin',
            'email' => 'superadmin@example.com',
            'password' => Hash::make('admin123'),
            'email_verified_at' => now(), // Mark as active
        ]);

        $superAdminRole = Role::where('slug', 'super_admin')->first();
        $superAdmin->roles()->attach($superAdminRole->id);

        // Make sure you also handle testUser logic if it exists, otherwise remove it
        // e.g.
        // $userRole = Role::where('slug', 'user')->first();
        // $testUser->roles()->attach($userRole->id);
    }
}
