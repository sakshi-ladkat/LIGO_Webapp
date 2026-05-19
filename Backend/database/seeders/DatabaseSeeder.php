<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
       
       $this->call([
            ContinentSeeder::class,
            CountrySeeder::class,
            CategorySeeder::class,
            InstituteSeeder::class,      
            RolePermissionSeeder::class,
            SystemSeeder::class,          
            SubsystemSeeder::class,
            ServiceSeeder::class,
            SubservicesSeeder::class,
            TitleSeeder::class,
            WorkflowSeeder::class,
            DurationSeeder::class,
            DummyDataSeeder::class
        ]);
       
    }
}
