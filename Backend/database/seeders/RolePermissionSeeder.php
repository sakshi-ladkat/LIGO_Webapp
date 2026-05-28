<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RolePermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Clear existing (Idempotent for roles/perms)
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');
        DB::table('roles_permissions')->truncate();
        DB::table('permissions')->truncate();
        DB::table('roles')->truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        // 2. Define Permissions
        $permissions = [
            // Application Management
            ['name' => 'Track Application', 'slug' => 'track_application', 'type' => 'Application'],
            ['name' => 'View Applications', 'slug' => 'view_applications', 'type' => 'Application'],
            ['name' => 'Approve Applications', 'slug' => 'approve_applications', 'type' => 'Application'],
            ['name' => 'Decline Applications', 'slug' => 'decline_applications', 'type' => 'Application'],
            ['name' => 'Modify Applications', 'slug' => 'modify_applications', 'type' => 'Application'],

            // User & Role Management
            ['name' => 'Manage Users', 'slug' => 'manage_users', 'type' => 'Identity'],
            ['name' => 'Manage Roles', 'slug' => 'manage_roles', 'type' => 'Identity'],
            ['name' => 'Assign Roles', 'slug' => 'assign_roles', 'type' => 'Identity'],
            ['name' => 'Approve Identity', 'slug' => 'approve_identity', 'type' => 'Identity'],
            ['name' => 'Invite Users', 'slug' => 'invite_users', 'type' => 'Identity'],

            // Institute & Entity Management
            ['name' => 'Manage Institutes', 'slug' => 'manage_institutes', 'type' => 'Entity'],
            ['name' => 'Manage Systems', 'slug' => 'manage_systems', 'type' => 'Entity'],
            ['name' => 'Manage Services', 'slug' => 'manage_services', 'type' => 'Entity'],
            ['name' => 'Configure Categories', 'slug' => 'manage_categories', 'type' => 'Entity'],
            ['name' => 'Manage Durations', 'slug' => 'manage_durations', 'type' => 'Entity'],
            ['name' => 'Manage Salutations', 'slug' => 'manage_salutations', 'type' => 'Entity'],
            ['name' => 'Manage Request Types', 'slug' => 'manage_requests', 'type' => 'Entity'],

            // System Configuration
            ['name' => 'System Settings', 'slug' => 'system_settings', 'type' => 'System'],
            ['name' => 'View Audit Logs', 'slug' => 'view_logs', 'type' => 'System'],
            ['name' => 'Manage Workflows', 'slug' => 'manage_workflows', 'type' => 'System'],
        ];

        foreach ($permissions as $p) {
            $p['created_at'] = now();
            $p['updated_at'] = now();
            DB::table('permissions')->insert($p);
        }

        // 3. Define Roles
        $roles = [
            ['name' => 'Super Admin', 'slug' => 'super_admin', 'level' => 90, 'is_active' => true],
            ['name' => 'Coordinator', 'slug' => 'coordinator', 'level' => 70, 'is_active' => true],
            ['name' => 'LI-Coordinator', 'slug' => 'li_coordinator', 'level' => 65, 'is_active' => true],
            ['name' => 'System Lead', 'slug' => 'system_lead', 'level' => 50, 'is_active' => true],
            ['name' => 'Subsystem Lead', 'slug' => 'subsystem_lead', 'level' => 40, 'is_active' => true],
            ['name' => 'Supervisor', 'slug' => 'supervisor', 'level' => 30, 'is_active' => true],
            ['name' => 'User', 'slug' => 'user', 'level' => 10, 'is_active' => true],
        ];

        // 4. Map Permissions to Minimum Required Levels
        $permLevels = [
            'track_application'   => 10,
            'view_applications'   => 30,
            'modify_applications' => 40,
            'approve_applications' => 30,
            'decline_applications'  => 30,
            
            'manage_users'         => 70,
            'manage_roles'         => 90,
            'assign_roles'         => 70,
            'approve_identity'     => 30,
            'invite_users'         => 30,
            
            'manage_institutes'    => 70,
            'manage_systems'       => 50,
            'manage_services'      => 40,
            'manage_categories'    => 70,
            'manage_durations'     => 70,
            'manage_salutations'   => 70,
            'manage_requests'      => 70,
            
            'system_settings'      => 90,
            'view_logs'            => 90,
            'manage_workflows'     => 70,
        ];

        foreach ($roles as $r) {
            $r['created_at'] = now();
            $r['updated_at'] = now();
            $roleId = DB::table('roles')->insertGetId($r);

            // Assign permissions where role level >= required level
            $perms = DB::table('permissions')->get();
            foreach ($perms as $perm) {
                $requiredLevel = $permLevels[$perm->slug] ?? 90; // Default to Super Admin if not defined
                
                if ($r['level'] >= $requiredLevel) {
                    DB::table('roles_permissions')->insert([
                        'role_id' => $roleId,
                        'permission_id' => $perm->id,
                        'is_active' => true,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]);
                }
            }
        }

        // 4. Create/Assign Super Admin to ALL for development
        $superRole = DB::table('roles')->where('slug', 'super_admin')->first();

        // Ensure superadmin account exists
        $adminId = DB::table('users')->where('email', 'superadmin@example.com')->value('user_id');
        if (!$adminId) {
            $adminId = (string)\Illuminate\Support\Str::ulid();
            DB::table('users')->insert([
                'user_id' => $adminId,
                'email' => 'superadmin@example.com',
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now()
            ]);
        }

        // Only assign super_admin to the actual superadmin account
        DB::table('user_roles')->updateOrInsert(
            ['user_id' => $adminId, 'role_id' => $superRole->id],
            ['is_active' => true, 'created_at' => now(), 'updated_at' => now()]
        );
    }
}