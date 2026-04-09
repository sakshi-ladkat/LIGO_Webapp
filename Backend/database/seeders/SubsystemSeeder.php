<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Subsystem;
use App\Models\System;
use App\Models\User;

class SubsystemSeeder extends Seeder
{
    public function run(): void
    {
        $system = System::where('code', 'HRD-CI')->first();
        $admin = User::where('email', 'superadmin@example.com')->first();

        // The Service seeder looks for a subsystem with code 'HRD-CI', 
        // which implies the subsystem also shares that code or there's a typo in ServiceSeeder.
        // We'll create one so ServiceSeeder doesn't fail.
        $subsystem = [
            'code'              => 'HRD-CI',
            'name'              => 'HRD-CI Subsystem',
            'type'              => 'Core',
            'description'       => 'Core HRD Computing Infrastructure Subsystem',
            'system_id'         => $system->id,
            'subsystem_lead_id' => $admin->user_id,
        ];

        Subsystem::updateOrCreate(
            ['name' => $subsystem['name']],
            $subsystem
        );

        $this->command->info('Subsystems seeded successfully!');
    }
}
