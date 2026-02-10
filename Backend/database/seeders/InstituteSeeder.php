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

            [ 'name' => 'Chennai Mathematical Institute (CMI)',
                'code' => 'CMI',
                'country' => 'India',
                'city' => 'Chennai',
                'is_active' => true,
            ],
            [
                'name' => 'CSIR-Central Glass & Ceramic Research Institute (CGCRI)',
                'code' => 'CGCRI',
                'country' => 'India',
                'city' => 'Kolkata',
                'is_active' => true,
            ],
            [
                'name' => 'Government Victoria College',
                'code' => 'GVC',
                'country' => 'India',
                'city' => 'Palakkad',
                'is_active' => true,
            ],
            [
                'name' => 'Directorate of Construction, Services & Estate Management (DCSEM)',
                'code' => 'DCSEM',
                'country' => 'India',
                'city' => 'Mumbai',
                'is_active' => true,
            ],
            [
                'name' => 'Indian Institute of Science Education and Research (IISER) - Kolkata',
                'code' => 'IISER-KOLKATA',
                'country' => 'India',
                'city' => 'Kolkata',
                'is_active' => true,
            ],
            [
                'name' => 'Indian Institute of Science Education and Research (IISER) - Pune',
                'code' => 'IISER-PUNE',
                'country' => 'India',
                'city' => 'Pune',
                'is_active' => true,
            ],
            [
                'name' => 'Indian Institute of Technology (IIT) - Bombay',
                'code' => 'IIT-BOMBAY',
                'country' => 'India',
                'city' => 'Mumbai',
                'is_active' => true,
            ],
            [
                'name' => 'Indian Institute of Technology (IIT) - Gandhinagar',
                'code' => 'IIT-GANDHINAGAR',
                'country' => 'India',
                'city' => 'Gandhinagar',
                'is_active' => true,
            ],
            [
                'name' => 'Indian Institute of Technology (IIT) - Hyderabad',
                'code' => 'IIT-HYDERABAD',
                'country' => 'India',
                'city' => 'Hyderabad',
                'is_active' => true,
            ],
            [
                'name' => 'Indian Institute of Technology (IIT) - Madras',
                'code' => 'IIT-MADRAS',
                'country' => 'India',
                'city' => 'Chennai',
                'is_active' => true,
            ],
            [
                'name' => 'Indian Institute for Plasma Research (IPR)',
                'code' => 'IPR',
                'country' => 'India',
                'city' => 'Gandhinagar',
                'is_active' => true,
            ],
            [
                'name' => 'International Centre for Theoretical Sciences, TIFR (ICTS-TIFR)',
                'code' => 'ICTS-TIFR',
                'country' => 'India',
                'city' => 'Bengaluru',
                'is_active' => true,
            ],
            [
                'name' => 'Inter-University Center for Astronomy & Astrophysics (IUCAA)',
                'code' => 'IUCAA',
                'country' => 'India',
                'city' => 'Pune',
                'is_active' => true,
            ],
            [
                'name' => 'National Institute of Technology (NIT)',
                'code' => 'NIT-CALICUT',
                'country' => 'India',
                'city' => 'Calicut',
                'is_active' => true,
            ],
            [
                'name' => 'Raja Ramanna Center for Advanced Technology (RRCAT)',
                'code' => 'RRCAT',
                'country' => 'India',
                'city' => 'Indore',
                'is_active' => true,
            ],
            [
                'name' => 'Saha Institute of Nuclear Physics (SINP)',
                'code' => 'SINP',
                'country' => 'India',
                'city' => 'Kolkata',
                'is_active' => true,
            ],
            [
                'name' => 'Tata Institute of Fundamental Research (TIFR)',
                'code' => 'TIFR',
                'country' => 'India',
                'city' => 'Mumbai',
                'is_active' => true,
            ],
        ];

        foreach ($institutes as $institute) {
            Institute::create($institute);
        }
    }
}