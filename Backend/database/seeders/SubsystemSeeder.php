<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\Subsystem;
use App\Models\System;
use App\Models\User;

class SubsystemSeeder extends Seeder
{
    public function run(): void
    {
        $system = System::where('code', 'HRD-CI')->first();
        $admin = User::where('email', 'superadmin@example.com')->first();

        $subId = DB::table('subsystems')->updateOrInsert(
            ['code' => 'HRD-CI'],
            [
                'name'              => 'HRD-CI Subsystem',
                'type'              => 'Core',
                'description'       => 'Core HRD Computing Infrastructure Subsystem',
                'system_id'         => $system->id,
                'is_active'         => true,
                'created_at'        => now(), 'updated_at' => now()
            ]
        );
        
        $subsystem = Subsystem::where('code', 'HRD-CI')->first();
        $subId = $subsystem->id;

        DB::table('services')->updateOrInsert(
            ['code' => 'COMP-GEN'],
            [
                'name'         => 'General Computing',
                'subsystem_id' => $subsystem->id,
                'type'         => 'Computing',
                'description'  => 'General purpose computing resources for project members.',
                'is_active'    => true,
                'created_at'   => now(), 'updated_at' => now()
            ]
        );

        DB::table('entity_assignments')->updateOrInsert(
            ['entity_type' => 'subsystem', 'entity_id' => $subId, 'user_id' => $admin->user_id],
            ['is_active' => true, 'assigned_at' => now(), 'created_at' => now(), 'updated_at' => now()]
        );

        $this->command->info('Subsystems seeded successfully!');
    }
}
