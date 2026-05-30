<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('permissions', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('type');
            $table->string('description')->nullable();
            $table->string('slug');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Insert Default Permissions
        $permissions = [
            ['id' => 1, 'name' => 'View Applications', 'slug' => 'view_applications', 'type' => 'Application'],
            ['id' => 2, 'name' => 'Approve Applications', 'slug' => 'approve_applications', 'type' => 'Application'],
            ['id' => 3, 'name' => 'Decline Applications', 'slug' => 'decline_applications', 'type' => 'Application'],
            ['id' => 4, 'name' => 'Modify Applications', 'slug' => 'modify_applications', 'type' => 'Application'],
            ['id' => 5, 'name' => 'Manage Users', 'slug' => 'manage_users', 'type' => 'Identity'],
            ['id' => 6, 'name' => 'Manage Roles', 'slug' => 'manage_roles', 'type' => 'Identity'],
            ['id' => 7, 'name' => 'Assign Roles', 'slug' => 'assign_roles', 'type' => 'Identity'],
            ['id' => 8, 'name' => 'Approve Identity', 'slug' => 'approve_identity', 'type' => 'Identity'],
            ['id' => 9, 'name' => 'Manage Institutes', 'slug' => 'manage_institutes', 'type' => 'Entity'],
            ['id' => 10, 'name' => 'Manage Systems', 'slug' => 'manage_systems', 'type' => 'Entity'],
            ['id' => 11, 'name' => 'Manage Services', 'slug' => 'manage_services', 'type' => 'Entity'],
            ['id' => 12, 'name' => 'Configure Categories', 'slug' => 'manage_categories', 'type' => 'Entity'],
            ['id' => 13, 'name' => 'System Settings', 'slug' => 'system_settings', 'type' => 'System'],
            ['id' => 14, 'name' => 'View Audit Logs', 'slug' => 'view_logs', 'type' => 'System'],
        ];

        foreach ($permissions as $p) {
            $p['created_at'] = now();
            $p['updated_at'] = now();
            DB::table('permissions')->insert($p);
        }

        Schema::create('roles_permissions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('role_id')
                ->constrained('roles')
                ->onUpdate('cascade')
                ->onDelete('cascade');
            $table->foreignId('permission_id')
                ->constrained('permissions')
                ->onUpdate('cascade')
                ->onDelete('cascade');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['role_id', 'permission_id'], 'roles_perms_role_id_perm_id_unique');
        });

        // Map Permissions to Roles (Manual mapping for migration)
        $mappings = [
            'super_admin' => [1,2,3,4,5,6,7,8,9,10,11,12,13,14],
            'coordinator' => [1,2,3,4,5,7,8,9,12],
            'li_coordinator' => [1,2,3,4,8],
            'system_lead' => [1,2,3,10],
            'subsystem_lead' => [1,2,3,11],
            'supervisor' => [1,2,3],
            'user' => [1],
        ];

        foreach ($mappings as $slug => $permIds) {
            $roleId = DB::table('roles')->where('slug', $slug)->value('id');
            if ($roleId) {
                foreach ($permIds as $pId) {
                    DB::table('roles_permissions')->insert([
                        'role_id' => $roleId,
                        'permission_id' => $pId,
                        'is_active' => true,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]);
                }
            }
        }

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('roles_permissions');
        Schema::dropIfExists('permissions');
    }
};