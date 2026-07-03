<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Duration;

class DurationSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $durations = [
            '2 Days',
            '3 Days',
            '4 Days',
            '5 Days',
            '6 Days',
            '7 Days',
            '10 Days',
            '15 Days',
            '1 Month',
            '3 Months',
            '6 Months',
            '1 Year',
            'Permanent'
        ];

        foreach ($durations as $name) {
            // Using updateOrCreate ensures no duplicates if run multiple times
            Duration::updateOrCreate(['name' => $name], ['is_active' => true]);
        }

        $this->command->info('Durations seeded successfully!');
    }
}
