<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\RegistrationData;
use App\Models\AccessRequest;
use App\Models\Role;

class TestDataSeeder extends Seeder
{
    public function run(): void
    {
        // Create 20 test users with related data
        for ($i = 0; $i < 20; $i++) {
            $registration = RegistrationData::factory()->create();
            
            $user = User::factory()->create([
                'email' => $registration->email,
                'institute_id' => $registration->institute_id,
                'registration_id' => $registration->id,
            ]);

            // Assign a random role (excluding super_admin)
            $roles = Role::where('slug', '!=', 'super_admin')->get();
            if ($roles->count() > 0) {
                $user->roles()->attach($roles->random()->id);
            }

            // Create 1-3 access requests for each user
            AccessRequest::factory()->count(rand(1, 3))->create([
                'user_id' => $user->id,
                'institute_id' => $user->institute_id,
            ]);
        }
    }
}
