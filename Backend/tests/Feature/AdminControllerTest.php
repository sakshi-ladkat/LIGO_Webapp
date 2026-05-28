<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\DB;

class AdminControllerTest extends TestCase
{
    use RefreshDatabase;

    private function getValidJwtToken(User $user)
    {
        $payload = [
            'iss' => 'http://localhost',
            'sub' => $user->user_id,
            'email' => $user->email,
            'iat' => time(),
            'exp' => time() + 7200,
        ];
        return JWT::encode($payload, env('JWT_SECRET', config('app.key')), 'HS256');
    }

    public function test_admin_can_toggle_user_block_status()
    {
        $admin = User::factory()->create();
        $targetUser = User::factory()->create(['status' => 'active']);

        // Give admin role and permission
        $roleId = DB::table('roles')->insertGetId(['name' => 'Admin', 'slug' => 'super_admin', 'level' => 100]);
        DB::table('user_roles')->insert(['user_id' => $admin->user_id, 'role_id' => $roleId, 'is_active' => true]);
        
        $permId = DB::table('permissions')->insertGetId(['name' => 'Manage Users', 'slug' => 'manage_users']);
        DB::table('role_permissions')->insert(['role_id' => $roleId, 'permission_id' => $permId]);

        $token = $this->getValidJwtToken($admin);

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
        ])->patchJson("/api/auth/admin/users/{$targetUser->user_id}/toggle-block", [
            'reason' => 'Violation of terms',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('users', [
            'user_id' => $targetUser->user_id,
            'status' => 'deactivated'
        ]);
        $this->assertDatabaseHas('block_history', [
            'user_id' => $targetUser->user_id,
            'action' => 'block'
        ]);
    }
}
