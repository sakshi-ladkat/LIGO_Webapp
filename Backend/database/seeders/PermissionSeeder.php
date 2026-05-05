<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Permission;

class PermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
       // Create Permissions
        $permissions = [
            // User Management
            ['name' => 'Create User', 'slug' => 'create_user', 'type' => 'User Management'],
            ['name' => 'Edit User', 'slug' => 'edit_user', 'type' => 'User Management'],
            ['name' => 'Delete User', 'slug' => 'delete_user', 'type' => 'User Management'],
            ['name' => 'View Users', 'slug' => 'view_users', 'type' => 'User Management'],
            ['name' => 'Assign Role', 'slug' => 'assign_role', 'type' => 'User Management'],
            
            // Role Management
            ['name' => 'Create Role', 'slug' => 'create_role', 'type' => 'Role Management'],
            ['name' => 'Edit Role', 'slug' => 'edit_role', 'type' => 'Role Management'],
            ['name' => 'Delete Role', 'slug' => 'delete_role', 'type' => 'Role Management'],
            
            // Approval Management
            ['name' => 'Approve Request', 'slug' => 'approve_request', 'type' => 'Approvals'],
            ['name' => 'Decline Request', 'slug' => 'decline_request', 'type' => 'Approvals'],
            ['name' => 'Override Approval', 'slug' => 'override_approval', 'type' => 'Approvals'],
            ['name' => 'Approve ID Card', 'slug' => 'approve_id_card', 'type' => 'Approvals'],
            
            // Report Management
            ['name' => 'View All Reports', 'slug' => 'view_all_reports', 'type' => 'Reports'],
            ['name' => 'View Organization Reports', 'slug' => 'view_org_reports', 'type' => 'Reports'],
            
            // System Management
            ['name' => 'Manage Systems', 'slug' => 'manage_systems', 'type' => 'System'],
            ['name' => 'Manage Subsystems', 'slug' => 'manage_subsystems', 'type' => 'System'],
            
            // Institute Management
            ['name' => 'Add Institute', 'slug' => 'add_institute', 'type' => 'Institute'],
            ['name' => 'Modify Institute', 'slug' => 'modify_institute', 'type' => 'Institute'],
            ['name' => 'Approve Institute', 'slug' => 'approve_institute', 'type' => 'Institute'],

            // Advanced Controls
            ['name' => 'Create Permission', 'slug' => 'create_permission', 'type' => 'System Control'],
        ];

        $permissionModels = [];
        foreach ($permissions as $p) {
            $permissionModels[$p['slug']] = Permission::updateOrCreate(
                ['slug' => $p['slug']],
                $p
            );
        }
    }
}
