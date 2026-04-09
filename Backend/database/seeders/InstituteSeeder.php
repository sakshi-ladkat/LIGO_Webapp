<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Institute;

class instituteSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $institutes = [
            [
                'name' => 'Directorate of Construction, Services & Estate Management (DCSEM)',
                'code' => 'DCSEM',
                'city' => 'Mumbai',
                'is_active' => true,
            ],
            [
                'name' => 'Indian Institute for Plasma Research (IPR)',
                'code' => 'IPR',
                'city' => 'Gandhinagar',
                'is_active' => true,
            ],
            [
                'name' => 'Inter-University Center for Astronomy & Astrophysics (IUCAA)',
                'code' => 'IUCAA',
                'city' => 'Pune',
                'is_active' => true,
            ],
            [
                'name' => 'Raja Ramanna Center for Advanced Technology (RRCAT)',
                'code' => 'RRCAT',
                'city' => 'Indore',
                'is_active' => true,
            ]
        ];

        foreach ($institutes as $institute) {
            Institute::updateOrCreate(
                ['code' => $institute['code']],
                $institute
            );
        }

        $this->command->info('Institutes seeded successfully!');
    }
}