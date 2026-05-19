<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Institute;

class InstituteSeeder extends Seeder
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
                'status' => 'approved',
                'is_active' => true,
                'has_li_coordinator' => true,
            ],
            [
                'name' => 'Indian Institute for Plasma Research (IPR)',
                'code' => 'IPR',
                'city' => 'Gandhinagar',
                'status' => 'approved',
                'is_active' => true,
                'has_li_coordinator' => true,
            ],
            [
                'name' => 'Inter-University Center for Astronomy & Astrophysics (IUCAA)',
                'code' => 'IUCAA',
                'city' => 'Pune',
                'status' => 'approved',
                'is_active' => true,
                'has_li_coordinator' => true,
            ],
            [
                'name' => 'Raja Ramanna Center for Advanced Technology (RRCAT)',
                'code' => 'RRCAT',
                'city' => 'Indore',
                'status' => 'approved',
                'is_active' => true,
                'has_li_coordinator' => true,
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