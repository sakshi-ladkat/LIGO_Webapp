<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // Add new permission for Reports & Analytics
        $permId = DB::table('permissions')->insertGetId([
            'name' => 'View Analytics',
            'slug' => 'view_analytics',
            'type' => 'System',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now()
        ]);

        // Assign exclusively to super_admin
        $roleId = DB::table('roles')->where('slug', 'super_admin')->value('id');
        if ($roleId && $permId) {
            DB::table('roles_permissions')->insert([
                'role_id' => $roleId,
                'permission_id' => $permId,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now()
            ]);
        }
    }

    public function down(): void
    {
        $permId = DB::table('permissions')->where('slug', 'view_analytics')->value('id');
        if ($permId) {
            DB::table('roles_permissions')->where('permission_id', $permId)->delete();
            DB::table('permissions')->where('id', $permId)->delete();
        }
    }
};
