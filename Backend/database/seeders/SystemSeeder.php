<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\System;
use App\Models\Institute;
use App\Models\User;

class SystemSeeder extends Seeder
{
    public function run(): void
    {
         $institute = Institute::first();
         $admin = User::where('email', 'superadmin@example.com')->first();

         $systems = [
            [
                'code'        => 'HRD-CI',
                'name'        => 'Human Resource Development and Computing infrastructure',
                'type'        => 'Main',
                'description' => 'This system encompasses the development and management of human resources and computing infrastructure...',
                'institute_id'=> $institute->id,
                'system_lead_id' => $admin->user_id,
            ]
         ];

         foreach ($systems as $sys) {
             System::updateOrCreate(
                 ['name' => $sys['name']],
                 $sys
             );
         }

         $this->command->info('Systems seeded successfully!');
    }
}
