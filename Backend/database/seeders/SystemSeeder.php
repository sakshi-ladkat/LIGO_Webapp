<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\System;
use App\Models\User;
use App\Models\Institute;

class SystemSeeder extends Seeder
{
    public function run(): void
    {
         $institute = Institute::first();
         $admin = User::where('email', 'superadmin@example.com')->first();
         $instId = $institute->id;

         $sid = DB::table('systems')->where('code', 'HRD-CI')->value('id');
         if (!$sid) {
             $sid = DB::table('systems')->insertGetId([
                'name' => 'Human Resource Development and Computing infrastructure',
                'code' => 'HRD-CI',
                'type' => 'Main',
                'description' => 'This system encompasses the development and management of human resources and computing infrastructure...',
                'institute_id' => $instId,
                'is_active' => true,
                'created_at' => now(), 'updated_at' => now(),
            ]);
         }

        DB::table('entity_assignments')->updateOrInsert(
            ['entity_type' => 'system', 'entity_id' => $sid, 'user_id' => $admin->user_id],
            ['is_active' => true, 'assigned_at' => now(), 'created_at' => now(), 'updated_at' => now()]
        );

         $this->command->info('Systems seeded successfully!');
    }
}
