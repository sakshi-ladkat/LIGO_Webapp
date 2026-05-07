<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Models\Role;
use App\Models\Institute;
use App\Models\Category;
use App\Models\System;
use App\Models\Subsystem;
use App\Models\UserProfile;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;
use Faker\Factory as Faker;

class DummyDataSeeder extends Seeder
{
    public function run(): void
    {
        $faker = Faker::create();
        
        $iucaa = Institute::where('name', 'like', '%IUCAA%')->first();
        if (!$iucaa) {
            $iucaa = Institute::first();
        }

        // Fetch target roles
        $supervisorRole = Role::firstOrCreate(['slug' => 'supervisor'], ['name' => 'Supervisor', 'level' => 30, 'is_active' => true]);
        $sysLeadRole = Role::firstOrCreate(['slug' => 'system_lead'], ['name' => 'System Lead', 'level' => 50, 'is_active' => true]);
        $subLeadRole = Role::firstOrCreate(['slug' => 'subsystem_lead'], ['name' => 'Subsystem Lead', 'level' => 40, 'is_active' => true]);
        $liRole = Role::firstOrCreate(['slug' => 'li_coordinator'], ['name' => 'LI-Coordinator', 'level' => 65, 'is_active' => true]);

        // Categories suitable for supervisor
        $facultyCat = Category::firstOrCreate(['name' => 'Faculty'], ['slug' => 'faculty', 'is_active' => true]);
        $researcherCat = Category::firstOrCreate(['name' => 'Researcher'], ['slug' => 'researcher', 'is_active' => true]);
        $staffCat = Category::firstOrCreate(['name' => 'Staff'], ['slug' => 'staff', 'is_active' => true]);
        $categories = [$facultyCat->id, $researcherCat->id, $staffCat->id];

        // 1. Create >10 Supervisors
        for ($i = 1; $i <= 12; $i++) {
            $firstName = $faker->firstName;
            $lastName = $faker->lastName;
            $email = strtolower($firstName . '.' . $lastName . '@example.com');

            $user = User::factory()->create([
                 'email' => $email,
                 'status' => 'active'
            ]);
            
            UserProfile::create([
                'user_id' => $user->user_id,
                'first_name' => $firstName,
                'last_name' => $lastName,
                'date_of_birth' => $faker->date('Y-m-d', '2000-01-01'),
                'gender' => 'other'
            ]);
            
            DB::table('user_roles')->updateOrInsert(
                ['user_id' => $user->user_id, 'role_id' => $supervisorRole->id],
                [
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );
            
            DB::table('user_affilation')->updateOrInsert(
                ['user_id' => $user->user_id, 'institute_id' => $iucaa->id, 'category_id' => $categories[array_rand($categories)]],
                [
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );
        }

        // 2. Create 1 System Lead per System
        $systems = System::all();
        foreach ($systems as $system) {
            $user = User::factory()->create([
                 'status' => 'active'
            ]);
            
            UserProfile::create([
                'user_id' => $user->user_id,
                'first_name' => $faker->firstName,
                'last_name' => $faker->lastName,
                'date_of_birth' => $faker->date('Y-m-d', '2000-01-01'),
                'gender' => 'other'
            ]);
            
            DB::table('user_roles')->updateOrInsert(
                ['user_id' => $user->user_id, 'role_id' => $sysLeadRole->id],
                [
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );

            DB::table('user_affilation')->updateOrInsert(
                ['user_id' => $user->user_id, 'institute_id' => $system->institute_id, 'category_id' => $staffCat->id],
                [
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );

            // Deactivate any existing active leads (e.g. from SystemSeeder)
            DB::table('entity_assignments')
                ->where('entity_type', 'system')
                ->where('entity_id', $system->id)
                ->where('is_active', true)
                ->update(['is_active' => false, 'deactivated_at' => now()]);

            DB::table('entity_assignments')->updateOrInsert(
                ['entity_type' => 'system', 'entity_id' => $system->id, 'user_id' => $user->user_id],
                [
                    'is_active' => true,
                    'assigned_at' => now(),
                    'deactivated_at' => null,
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );
        }

        // 3. Create 1 Subsystem Lead per Subsystem
        $subsystems = Subsystem::all();
        foreach ($subsystems as $sub) {
            $user = User::factory()->create([
                 'status' => 'active'
            ]);
            
            UserProfile::create([
                'user_id' => $user->user_id,
                'first_name' => $faker->firstName,
                'last_name' => $faker->lastName,
                'date_of_birth' => $faker->date('Y-m-d', '2000-01-01'),
                'gender' => 'other'
            ]);
            
            DB::table('user_roles')->updateOrInsert(
                ['user_id' => $user->user_id, 'role_id' => $subLeadRole->id],
                [
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );

            $parentSystem = DB::table('systems')->where('id', $sub->system_id)->first();
            
            DB::table('user_affilation')->updateOrInsert(
                ['user_id' => $user->user_id, 'institute_id' => $parentSystem->institute_id, 'category_id' => $staffCat->id],
                [
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );

            // Deactivate any existing active leads (e.g. from SubsystemSeeder)
            DB::table('entity_assignments')
                ->where('entity_type', 'subsystem')
                ->where('entity_id', $sub->id)
                ->where('is_active', true)
                ->update(['is_active' => false, 'deactivated_at' => now()]);

            DB::table('entity_assignments')->updateOrInsert(
                ['entity_type' => 'subsystem', 'entity_id' => $sub->id, 'user_id' => $user->user_id],
                [
                    'is_active' => true,
                    'assigned_at' => now(),
                    'deactivated_at' => null,
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );
        }

        // 4. Create 1 LI-Coordinator per Institute
        $institutes = Institute::all();
        foreach ($institutes as $inst) {
            $firstName = $faker->firstName;
            $lastName = $faker->lastName;
            $email = strtolower('licoord.' . preg_replace('/[^a-zA-Z0-9]/', '', $inst->name) . '@example.com');

            $user = User::factory()->create([
                 'email' => $email,
                 'status' => 'active'
            ]);

            UserProfile::create([
                'user_id' => $user->user_id,
                'first_name' => $faker->firstName,
                'last_name' => $faker->lastName,
                'date_of_birth' => $faker->date('Y-m-d', '2000-01-01'),
                'gender' => 'other'
            ]);
            
            DB::table('user_roles')->updateOrInsert(
                ['user_id' => $user->user_id, 'role_id' => $liRole->id],
                [
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );

            DB::table('user_affilation')->updateOrInsert(
                ['user_id' => $user->user_id, 'institute_id' => $inst->id, 'category_id' => $facultyCat->id],
                [
                    'is_active' => true,
                    'created_at' => now(),
                    'updated_at' => now()
                ]
            );
        }
    }
}
