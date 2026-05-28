<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Institute;
use App\Models\Category;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\DB;

class RegistrationControllerTest extends TestCase
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

    public function test_registration_requires_auth()
    {
        $response = $this->postJson('/api/auth/registration', []);
        // Should be unauthorized
        $response->assertStatus(401);
    }

    public function test_registration_success_with_valid_token()
    {
        Storage::fake('local');
        
        $user = User::factory()->create(['status' => 'onboarding']);
        $token = $this->getValidJwtToken($user);

        // create designation category for student
        $cat = DB::table('categories')->insertGetId([
            'name' => 'Student',
            'slug' => 'student',
            'parent_id' => 1,
            'created_at' => now(),
            'updated_at' => now()
        ]);

        $file = UploadedFile::fake()->image('id_card.jpg');

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
        ])->postJson('/api/auth/registration', [
            'firstName' => 'John',
            'lastName' => 'Doe',
            'graduationYear' => '2024',
            'graduationMonth' => '5',
            'department' => 'CS',
            'designation' => $cat,
            'id_card' => $file,
            'institute' => 'other',
            'otherInstitute' => 'Test Institute',
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('users', ['user_id' => $user->user_id, 'status' => 'submitted']);
    }

    public function test_registration_fails_if_blocked()
    {
        Storage::fake('local');
        
        $user = User::factory()->create(['status' => 'deactivated']);
        $token = $this->getValidJwtToken($user);

        $file = UploadedFile::fake()->image('id_card.jpg');

        $response = $this->withHeaders([
            'Authorization' => 'Bearer ' . $token,
        ])->postJson('/api/auth/registration', [
            'graduationYear' => '2024',
            'graduationMonth' => '5',
            'department' => 'CS',
            'id_card' => $file,
            'institute' => 'other',
            'otherInstitute' => 'Test Institute',
        ]);

        // JwtMiddleware returns 403 PROFILE_BLOCKED for deactivated users
        $response->assertStatus(403);
    }
}
