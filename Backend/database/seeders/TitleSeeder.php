<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class TitleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $titles = ['Mr', 'Ms', 'Mrs', 'Dr', 'Prof'];
        foreach ($titles as $t) {
            \App\Models\Title::firstOrCreate(['name' => $t, 'is_active' => true]);
        }
    }
}
