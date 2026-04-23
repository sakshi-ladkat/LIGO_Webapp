<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Country;
use App\Models\Continent;

class CountrySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $africa = Continent::where('code', 'AF')->firstOrFail();
        $asia = Continent::where('code', 'AS')->firstOrFail();
        $europe = Continent::where('code', 'EU')->firstOrFail();
        $northAmerica = Continent::where('code', 'NA')->firstOrFail();
        $southAmerica = Continent::where('code', 'SA')->firstOrFail();
        $oceania = Continent::where('code', 'OC')->firstOrFail();
        $antarctica = Continent::where('code', 'AN')->firstOrFail(); // no countries

        $countries = [

            // -------------------- AFRICA --------------------
            ['continent_id' => $africa->id, 'name' => 'Algeria', 'code' => 'DZA', 'country_code' => '+213'],
            ['continent_id' => $africa->id, 'name' => 'Angola', 'code' => 'AGO', 'country_code' => '+244'],
            ['continent_id' => $africa->id, 'name' => 'Benin', 'code' => 'BEN', 'country_code' => '+229'],
            ['continent_id' => $africa->id, 'name' => 'Botswana', 'code' => 'BWA', 'country_code' => '+267'],
            ['continent_id' => $africa->id, 'name' => 'Burkina Faso', 'code' => 'BFA', 'country_code' => '+226'],
            ['continent_id' => $africa->id, 'name' => 'Burundi', 'code' => 'BDI', 'country_code' => '+257'],
            ['continent_id' => $africa->id, 'name' => 'Cameroon', 'code' => 'CMR', 'country_code' => '+237'],
            ['continent_id' => $africa->id, 'name' => 'Chad', 'code' => 'TCD', 'country_code' => '+235'],
            ['continent_id' => $africa->id, 'name' => 'Comoros', 'code' => 'COM', 'country_code' => '+269'],
            ['continent_id' => $africa->id, 'name' => 'Congo', 'code' => 'COG', 'country_code' => '+242'],
            ['continent_id' => $africa->id, 'name' => 'DR Congo', 'code' => 'COD', 'country_code' => '+243'],
            ['continent_id' => $africa->id, 'name' => 'Egypt', 'code' => 'EGY', 'country_code' => '+20'],
            ['continent_id' => $africa->id, 'name' => 'Ethiopia', 'code' => 'ETH', 'country_code' => '+251'],
            ['continent_id' => $africa->id, 'name' => 'Gabon', 'code' => 'GAB', 'country_code' => '+241'],
            ['continent_id' => $africa->id, 'name' => 'Gambia', 'code' => 'GMB', 'country_code' => '+220'],
            ['continent_id' => $africa->id, 'name' => 'Ghana', 'code' => 'GHA', 'country_code' => '+233'],
            ['continent_id' => $africa->id, 'name' => 'Guinea', 'code' => 'GIN', 'country_code' => '+224'],
            ['continent_id' => $africa->id, 'name' => 'Kenya', 'code' => 'KEN', 'country_code' => '+254'],
            ['continent_id' => $africa->id, 'name' => 'Liberia', 'code' => 'LBR', 'country_code' => '+231'],
            ['continent_id' => $africa->id, 'name' => 'Libya', 'code' => 'LBY', 'country_code' => '+218'],
            ['continent_id' => $africa->id, 'name' => 'Madagascar', 'code' => 'MDG', 'country_code' => '+261'],
            ['continent_id' => $africa->id, 'name' => 'Malawi', 'code' => 'MWI', 'country_code' => '+265'],
            ['continent_id' => $africa->id, 'name' => 'Mali', 'code' => 'MLI', 'country_code' => '+223'],
            ['continent_id' => $africa->id, 'name' => 'Morocco', 'code' => 'MAR', 'country_code' => '+212'],
            ['continent_id' => $africa->id, 'name' => 'Mozambique', 'code' => 'MOZ', 'country_code' => '+258'],
            ['continent_id' => $africa->id, 'name' => 'Namibia', 'code' => 'NAM', 'country_code' => '+264'],
            ['continent_id' => $africa->id, 'name' => 'Niger', 'code' => 'NER', 'country_code' => '+227'],
            ['continent_id' => $africa->id, 'name' => 'Nigeria', 'code' => 'NGA', 'country_code' => '+234'],
            ['continent_id' => $africa->id, 'name' => 'Rwanda', 'code' => 'RWA', 'country_code' => '+250'],
            ['continent_id' => $africa->id, 'name' => 'Senegal', 'code' => 'SEN', 'country_code' => '+221'],
            ['continent_id' => $africa->id, 'name' => 'Somalia', 'code' => 'SOM', 'country_code' => '+252'],
            ['continent_id' => $africa->id, 'name' => 'South Africa', 'code' => 'ZAF', 'country_code' => '+27'],
            ['continent_id' => $africa->id, 'name' => 'Sudan', 'code' => 'SDN', 'country_code' => '+249'],
            ['continent_id' => $africa->id, 'name' => 'Tanzania', 'code' => 'TZA', 'country_code' => '+255'],
            ['continent_id' => $africa->id, 'name' => 'Togo', 'code' => 'TGO', 'country_code' => '+228'],
            ['continent_id' => $africa->id, 'name' => 'Tunisia', 'code' => 'TUN', 'country_code' => '+216'],
            ['continent_id' => $africa->id, 'name' => 'Uganda', 'code' => 'UGA', 'country_code' => '+256'],
            ['continent_id' => $africa->id, 'name' => 'Zambia', 'code' => 'ZMB', 'country_code' => '+260'],
            ['continent_id' => $africa->id, 'name' => 'Zimbabwe', 'code' => 'ZWE', 'country_code' => '+263'],

            // -------------------- ASIA --------------------
            ['continent_id' => $asia->id, 'name' => 'India', 'code' => 'IND', 'country_code' => '+91'],
            ['continent_id' => $asia->id, 'name' => 'China', 'code' => 'CHN', 'country_code' => '+86'],
            ['continent_id' => $asia->id, 'name' => 'Japan', 'code' => 'JPN', 'country_code' => '+81'],
            ['continent_id' => $asia->id, 'name' => 'South Korea', 'code' => 'KOR', 'country_code' => '+82'],
            ['continent_id' => $asia->id, 'name' => 'Singapore', 'code' => 'SGP', 'country_code' => '+65'],
            ['continent_id' => $asia->id, 'name' => 'Pakistan', 'code' => 'PAK', 'country_code' => '+92'],
            ['continent_id' => $asia->id, 'name' => 'Bangladesh', 'code' => 'BGD', 'country_code' => '+880'],
            ['continent_id' => $asia->id, 'name' => 'Nepal', 'code' => 'NPL', 'country_code' => '+977'],
            ['continent_id' => $asia->id, 'name' => 'Sri Lanka', 'code' => 'LKA', 'country_code' => '+94'],
            ['continent_id' => $asia->id, 'name' => 'Indonesia', 'code' => 'IDN', 'country_code' => '+62'],
            ['continent_id' => $asia->id, 'name' => 'Malaysia', 'code' => 'MYS', 'country_code' => '+60'],
            ['continent_id' => $asia->id, 'name' => 'Thailand', 'code' => 'THA', 'country_code' => '+66'],
            ['continent_id' => $asia->id, 'name' => 'Vietnam', 'code' => 'VNM', 'country_code' => '+84'],
            ['continent_id' => $asia->id, 'name' => 'Saudi Arabia', 'code' => 'SAU', 'country_code' => '+966'],
            ['continent_id' => $asia->id, 'name' => 'United Arab Emirates', 'code' => 'ARE', 'country_code' => '+971'],
            ['continent_id' => $asia->id, 'name' => 'Israel', 'code' => 'ISR', 'country_code' => '+972'],
            ['continent_id' => $asia->id, 'name' => 'Turkey', 'code' => 'TUR', 'country_code' => '+90'],
            ['continent_id' => $asia->id, 'name' => 'Iran', 'code' => 'IRN', 'country_code' => '+98'],
            ['continent_id' => $asia->id, 'name' => 'Iraq', 'code' => 'IRQ', 'country_code' => '+964'],
            ['continent_id' => $asia->id, 'name' => 'Qatar', 'code' => 'QAT', 'country_code' => '+974'],
            ['continent_id' => $asia->id, 'name' => 'Oman', 'code' => 'OMN', 'country_code' => '+968'],
            ['continent_id' => $asia->id, 'name' => 'Kuwait', 'code' => 'KWT', 'country_code' => '+965'],

            // -------------------- EUROPE --------------------
            ['continent_id' => $europe->id, 'name' => 'United Kingdom', 'code' => 'GBR', 'country_code' => '+44'],
            ['continent_id' => $europe->id, 'name' => 'Germany', 'code' => 'DEU', 'country_code' => '+49'],
            ['continent_id' => $europe->id, 'name' => 'France', 'code' => 'FRA', 'country_code' => '+33'],
            ['continent_id' => $europe->id, 'name' => 'Italy', 'code' => 'ITA', 'country_code' => '+39'],
            ['continent_id' => $europe->id, 'name' => 'Spain', 'code' => 'ESP', 'country_code' => '+34'],
            ['continent_id' => $europe->id, 'name' => 'Netherlands', 'code' => 'NLD', 'country_code' => '+31'],
            ['continent_id' => $europe->id, 'name' => 'Switzerland', 'code' => 'CHE', 'country_code' => '+41'],
            ['continent_id' => $europe->id, 'name' => 'Sweden', 'code' => 'SWE', 'country_code' => '+46'],
            ['continent_id' => $europe->id, 'name' => 'Norway', 'code' => 'NOR', 'country_code' => '+47'],
            ['continent_id' => $europe->id, 'name' => 'Denmark', 'code' => 'DNK', 'country_code' => '+45'],
            ['continent_id' => $europe->id, 'name' => 'Belgium', 'code' => 'BEL', 'country_code' => '+32'],
            ['continent_id' => $europe->id, 'name' => 'Austria', 'code' => 'AUT', 'country_code' => '+43'],
            ['continent_id' => $europe->id, 'name' => 'Poland', 'code' => 'POL', 'country_code' => '+48'],
            ['continent_id' => $europe->id, 'name' => 'Portugal', 'code' => 'PRT', 'country_code' => '+351'],
            ['continent_id' => $europe->id, 'name' => 'Greece', 'code' => 'GRC', 'country_code' => '+30'],
            ['continent_id' => $europe->id, 'name' => 'Ireland', 'code' => 'IRL', 'country_code' => '+353'],
            ['continent_id' => $europe->id, 'name' => 'Finland', 'code' => 'FIN', 'country_code' => '+358'],
            ['continent_id' => $europe->id, 'name' => 'Romania', 'code' => 'ROU', 'country_code' => '+40'],
            ['continent_id' => $europe->id, 'name' => 'Hungary', 'code' => 'HUN', 'country_code' => '+36'],
            ['continent_id' => $europe->id, 'name' => 'Ukraine', 'code' => 'UKR', 'country_code' => '+380'],

            // -------------------- NORTH AMERICA --------------------
            ['continent_id' => $northAmerica->id, 'name' => 'United States', 'code' => 'USA', 'country_code' => '+1'],
            ['continent_id' => $northAmerica->id, 'name' => 'Canada', 'code' => 'CAN', 'country_code' => '+1'],
            ['continent_id' => $northAmerica->id, 'name' => 'Mexico', 'code' => 'MEX', 'country_code' => '+52'],
            ['continent_id' => $northAmerica->id, 'name' => 'Cuba', 'code' => 'CUB', 'country_code' => '+53'],
            ['continent_id' => $northAmerica->id, 'name' => 'Jamaica', 'code' => 'JAM', 'country_code' => '+1-876'],
            ['continent_id' => $northAmerica->id, 'name' => 'Costa Rica', 'code' => 'CRI', 'country_code' => '+506'],
            ['continent_id' => $northAmerica->id, 'name' => 'Panama', 'code' => 'PAN', 'country_code' => '+507'],
            ['continent_id' => $northAmerica->id, 'name' => 'Guatemala', 'code' => 'GTM', 'country_code' => '+502'],
            ['continent_id' => $northAmerica->id, 'name' => 'Honduras', 'code' => 'HND', 'country_code' => '+504'],
            ['continent_id' => $northAmerica->id, 'name' => 'Nicaragua', 'code' => 'NIC', 'country_code' => '+505'],
            ['continent_id' => $northAmerica->id, 'name' => 'Dominican Republic', 'code' => 'DOM', 'country_code' => '+1-809'],

            // -------------------- SOUTH AMERICA --------------------
            ['continent_id' => $southAmerica->id, 'name' => 'Brazil', 'code' => 'BRA', 'country_code' => '+55'],
            ['continent_id' => $southAmerica->id, 'name' => 'Argentina', 'code' => 'ARG', 'country_code' => '+54'],
            ['continent_id' => $southAmerica->id, 'name' => 'Chile', 'code' => 'CHL', 'country_code' => '+56'],
            ['continent_id' => $southAmerica->id, 'name' => 'Colombia', 'code' => 'COL', 'country_code' => '+57'],
            ['continent_id' => $southAmerica->id, 'name' => 'Peru', 'code' => 'PER', 'country_code' => '+51'],
            ['continent_id' => $southAmerica->id, 'name' => 'Venezuela', 'code' => 'VEN', 'country_code' => '+58'],
            ['continent_id' => $southAmerica->id, 'name' => 'Ecuador', 'code' => 'ECU', 'country_code' => '+593'],
            ['continent_id' => $southAmerica->id, 'name' => 'Uruguay', 'code' => 'URY', 'country_code' => '+598'],
            ['continent_id' => $southAmerica->id, 'name' => 'Bolivia', 'code' => 'BOL', 'country_code' => '+591'],
            ['continent_id' => $southAmerica->id, 'name' => 'Paraguay', 'code' => 'PRY', 'country_code' => '+595'],
            ['continent_id' => $southAmerica->id, 'name' => 'Suriname', 'code' => 'SUR', 'country_code' => '+597'],
            ['continent_id' => $southAmerica->id, 'name' => 'Guyana', 'code' => 'GUY', 'country_code' => '+592'],

            // -------------------- OCEANIA --------------------
            ['continent_id' => $oceania->id, 'name' => 'Australia', 'code' => 'AUS', 'country_code' => '+61'],
            ['continent_id' => $oceania->id, 'name' => 'New Zealand', 'code' => 'NZL', 'country_code' => '+64'],
            ['continent_id' => $oceania->id, 'name' => 'Fiji', 'code' => 'FJI', 'country_code' => '+679'],
            ['continent_id' => $oceania->id, 'name' => 'Papua New Guinea', 'code' => 'PNG', 'country_code' => '+675'],
            ['continent_id' => $oceania->id, 'name' => 'Samoa', 'code' => 'WSM', 'country_code' => '+685'],
            ['continent_id' => $oceania->id, 'name' => 'Tonga', 'code' => 'TON', 'country_code' => '+676'],
            ['continent_id' => $oceania->id, 'name' => 'Solomon Islands', 'code' => 'SLB', 'country_code' => '+677'],
            ['continent_id' => $oceania->id, 'name' => 'Vanuatu', 'code' => 'VUT', 'country_code' => '+678'],
        ];

        foreach ($countries as $country) {
            Country::updateOrCreate(
                ['code' => $country['code']],
                $country
            );
        }

        $this->command->info('Countries seeded successfully! Total: ' . count($countries));
    }
}
