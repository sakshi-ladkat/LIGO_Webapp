<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Continent;

class ContinentSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
         $continents = [
            ['name' => 'Africa', 'code' => 'AF', 'is_active' => true],
            ['name' => 'Antarctica', 'code' => 'AN', 'is_active' => true],
            ['name' => 'Asia', 'code' => 'AS', 'is_active' => true],
            ['name' => 'Europe', 'code' => 'EU', 'is_active' => true],
            ['name' => 'North America', 'code' => 'NA', 'is_active' => true],
            ['name' => 'Oceania', 'code' => 'OC', 'is_active' => true],
            ['name' => 'South America', 'code' => 'SA', 'is_active' => true],
        ];

        foreach ($continents as $continent) {
            Continent::updateOrCreate(
                ['code' => $continent['code']],
                $continent
            );
        }

        $this->command->info('Continents seeded successfully!');
    }
}
