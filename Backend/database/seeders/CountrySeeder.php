<?php

namespace Database\Seeders;

use App\Models\Continent;
use App\Models\Country;
use Illuminate\Database\Seeder;

class CountrySeeder extends Seeder
{
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
            ['continent_id' => $africa->id, 'name' => 'Algeria', 'code' => 'DZA', 'phone_code' => '+213'],
            ['continent_id' => $africa->id, 'name' => 'Angola', 'code' => 'AGO', 'phone_code' => '+244'],
            ['continent_id' => $africa->id, 'name' => 'Benin', 'code' => 'BEN', 'phone_code' => '+229'],
            ['continent_id' => $africa->id, 'name' => 'Botswana', 'code' => 'BWA', 'phone_code' => '+267'],
            ['continent_id' => $africa->id, 'name' => 'Burkina Faso', 'code' => 'BFA', 'phone_code' => '+226'],
            ['continent_id' => $africa->id, 'name' => 'Burundi', 'code' => 'BDI', 'phone_code' => '+257'],
            ['continent_id' => $africa->id, 'name' => 'Cameroon', 'code' => 'CMR', 'phone_code' => '+237'],
            ['continent_id' => $africa->id, 'name' => 'Chad', 'code' => 'TCD', 'phone_code' => '+235'],
            ['continent_id' => $africa->id, 'name' => 'Comoros', 'code' => 'COM', 'phone_code' => '+269'],
            ['continent_id' => $africa->id, 'name' => 'Congo', 'code' => 'COG', 'phone_code' => '+242'],
            ['continent_id' => $africa->id, 'name' => 'DR Congo', 'code' => 'COD', 'phone_code' => '+243'],
            ['continent_id' => $africa->id, 'name' => 'Egypt', 'code' => 'EGY', 'phone_code' => '+20'],
            ['continent_id' => $africa->id, 'name' => 'Ethiopia', 'code' => 'ETH', 'phone_code' => '+251'],
            ['continent_id' => $africa->id, 'name' => 'Gabon', 'code' => 'GAB', 'phone_code' => '+241'],
            ['continent_id' => $africa->id, 'name' => 'Gambia', 'code' => 'GMB', 'phone_code' => '+220'],
            ['continent_id' => $africa->id, 'name' => 'Ghana', 'code' => 'GHA', 'phone_code' => '+233'],
            ['continent_id' => $africa->id, 'name' => 'Guinea', 'code' => 'GIN', 'phone_code' => '+224'],
            ['continent_id' => $africa->id, 'name' => 'Kenya', 'code' => 'KEN', 'phone_code' => '+254'],
            ['continent_id' => $africa->id, 'name' => 'Liberia', 'code' => 'LBR', 'phone_code' => '+231'],
            ['continent_id' => $africa->id, 'name' => 'Libya', 'code' => 'LBY', 'phone_code' => '+218'],
            ['continent_id' => $africa->id, 'name' => 'Madagascar', 'code' => 'MDG', 'phone_code' => '+261'],
            ['continent_id' => $africa->id, 'name' => 'Malawi', 'code' => 'MWI', 'phone_code' => '+265'],
            ['continent_id' => $africa->id, 'name' => 'Mali', 'code' => 'MLI', 'phone_code' => '+223'],
            ['continent_id' => $africa->id, 'name' => 'Morocco', 'code' => 'MAR', 'phone_code' => '+212'],
            ['continent_id' => $africa->id, 'name' => 'Mozambique', 'code' => 'MOZ', 'phone_code' => '+258'],
            ['continent_id' => $africa->id, 'name' => 'Namibia', 'code' => 'NAM', 'phone_code' => '+264'],
            ['continent_id' => $africa->id, 'name' => 'Niger', 'code' => 'NER', 'phone_code' => '+227'],
            ['continent_id' => $africa->id, 'name' => 'Nigeria', 'code' => 'NGA', 'phone_code' => '+234'],
            ['continent_id' => $africa->id, 'name' => 'Rwanda', 'code' => 'RWA', 'phone_code' => '+250'],
            ['continent_id' => $africa->id, 'name' => 'Senegal', 'code' => 'SEN', 'phone_code' => '+221'],
            ['continent_id' => $africa->id, 'name' => 'Somalia', 'code' => 'SOM', 'phone_code' => '+252'],
            ['continent_id' => $africa->id, 'name' => 'South Africa', 'code' => 'ZAF', 'phone_code' => '+27'],
            ['continent_id' => $africa->id, 'name' => 'Sudan', 'code' => 'SDN', 'phone_code' => '+249'],
            ['continent_id' => $africa->id, 'name' => 'Tanzania', 'code' => 'TZA', 'phone_code' => '+255'],
            ['continent_id' => $africa->id, 'name' => 'Togo', 'code' => 'TGO', 'phone_code' => '+228'],
            ['continent_id' => $africa->id, 'name' => 'Tunisia', 'code' => 'TUN', 'phone_code' => '+216'],
            ['continent_id' => $africa->id, 'name' => 'Uganda', 'code' => 'UGA', 'phone_code' => '+256'],
            ['continent_id' => $africa->id, 'name' => 'Zambia', 'code' => 'ZMB', 'phone_code' => '+260'],
            ['continent_id' => $africa->id, 'name' => 'Zimbabwe', 'code' => 'ZWE', 'phone_code' => '+263'],

            // -------------------- ASIA --------------------
            ['continent_id' => $asia->id, 'name' => 'India', 'code' => 'IND', 'phone_code' => '+91'],
            ['continent_id' => $asia->id, 'name' => 'China', 'code' => 'CHN', 'phone_code' => '+86'],
            ['continent_id' => $asia->id, 'name' => 'Japan', 'code' => 'JPN', 'phone_code' => '+81'],
            ['continent_id' => $asia->id, 'name' => 'South Korea', 'code' => 'KOR', 'phone_code' => '+82'],
            ['continent_id' => $asia->id, 'name' => 'Singapore', 'code' => 'SGP', 'phone_code' => '+65'],
            ['continent_id' => $asia->id, 'name' => 'Pakistan', 'code' => 'PAK', 'phone_code' => '+92'],
            ['continent_id' => $asia->id, 'name' => 'Bangladesh', 'code' => 'BGD', 'phone_code' => '+880'],
            ['continent_id' => $asia->id, 'name' => 'Nepal', 'code' => 'NPL', 'phone_code' => '+977'],
            ['continent_id' => $asia->id, 'name' => 'Sri Lanka', 'code' => 'LKA', 'phone_code' => '+94'],
            ['continent_id' => $asia->id, 'name' => 'Indonesia', 'code' => 'IDN', 'phone_code' => '+62'],
            ['continent_id' => $asia->id, 'name' => 'Malaysia', 'code' => 'MYS', 'phone_code' => '+60'],
            ['continent_id' => $asia->id, 'name' => 'Thailand', 'code' => 'THA', 'phone_code' => '+66'],
            ['continent_id' => $asia->id, 'name' => 'Vietnam', 'code' => 'VNM', 'phone_code' => '+84'],
            ['continent_id' => $asia->id, 'name' => 'Saudi Arabia', 'code' => 'SAU', 'phone_code' => '+966'],
            ['continent_id' => $asia->id, 'name' => 'United Arab Emirates', 'code' => 'ARE', 'phone_code' => '+971'],
            ['continent_id' => $asia->id, 'name' => 'Israel', 'code' => 'ISR', 'phone_code' => '+972'],
            ['continent_id' => $asia->id, 'name' => 'Turkey', 'code' => 'TUR', 'phone_code' => '+90'],
            ['continent_id' => $asia->id, 'name' => 'Iran', 'code' => 'IRN', 'phone_code' => '+98'],
            ['continent_id' => $asia->id, 'name' => 'Iraq', 'code' => 'IRQ', 'phone_code' => '+964'],
            ['continent_id' => $asia->id, 'name' => 'Qatar', 'code' => 'QAT', 'phone_code' => '+974'],
            ['continent_id' => $asia->id, 'name' => 'Oman', 'code' => 'OMN', 'phone_code' => '+968'],
            ['continent_id' => $asia->id, 'name' => 'Kuwait', 'code' => 'KWT', 'phone_code' => '+965'],

            // -------------------- EUROPE --------------------
            ['continent_id' => $europe->id, 'name' => 'United Kingdom', 'code' => 'GBR', 'phone_code' => '+44'],
            ['continent_id' => $europe->id, 'name' => 'Germany', 'code' => 'DEU', 'phone_code' => '+49'],
            ['continent_id' => $europe->id, 'name' => 'France', 'code' => 'FRA', 'phone_code' => '+33'],
            ['continent_id' => $europe->id, 'name' => 'Italy', 'code' => 'ITA', 'phone_code' => '+39'],
            ['continent_id' => $europe->id, 'name' => 'Spain', 'code' => 'ESP', 'phone_code' => '+34'],
            ['continent_id' => $europe->id, 'name' => 'Netherlands', 'code' => 'NLD', 'phone_code' => '+31'],
            ['continent_id' => $europe->id, 'name' => 'Switzerland', 'code' => 'CHE', 'phone_code' => '+41'],
            ['continent_id' => $europe->id, 'name' => 'Sweden', 'code' => 'SWE', 'phone_code' => '+46'],
            ['continent_id' => $europe->id, 'name' => 'Norway', 'code' => 'NOR', 'phone_code' => '+47'],
            ['continent_id' => $europe->id, 'name' => 'Denmark', 'code' => 'DNK', 'phone_code' => '+45'],
            ['continent_id' => $europe->id, 'name' => 'Belgium', 'code' => 'BEL', 'phone_code' => '+32'],
            ['continent_id' => $europe->id, 'name' => 'Austria', 'code' => 'AUT', 'phone_code' => '+43'],
            ['continent_id' => $europe->id, 'name' => 'Poland', 'code' => 'POL', 'phone_code' => '+48'],
            ['continent_id' => $europe->id, 'name' => 'Portugal', 'code' => 'PRT', 'phone_code' => '+351'],
            ['continent_id' => $europe->id, 'name' => 'Greece', 'code' => 'GRC', 'phone_code' => '+30'],
            ['continent_id' => $europe->id, 'name' => 'Ireland', 'code' => 'IRL', 'phone_code' => '+353'],
            ['continent_id' => $europe->id, 'name' => 'Finland', 'code' => 'FIN', 'phone_code' => '+358'],
            ['continent_id' => $europe->id, 'name' => 'Romania', 'code' => 'ROU', 'phone_code' => '+40'],
            ['continent_id' => $europe->id, 'name' => 'Hungary', 'code' => 'HUN', 'phone_code' => '+36'],
            ['continent_id' => $europe->id, 'name' => 'Ukraine', 'code' => 'UKR', 'phone_code' => '+380'],

            // -------------------- NORTH AMERICA --------------------
            ['continent_id' => $northAmerica->id, 'name' => 'United States', 'code' => 'USA', 'phone_code' => '+1'],
            ['continent_id' => $northAmerica->id, 'name' => 'Canada', 'code' => 'CAN', 'phone_code' => '+1'],
            ['continent_id' => $northAmerica->id, 'name' => 'Mexico', 'code' => 'MEX', 'phone_code' => '+52'],
            ['continent_id' => $northAmerica->id, 'name' => 'Cuba', 'code' => 'CUB', 'phone_code' => '+53'],
            ['continent_id' => $northAmerica->id, 'name' => 'Jamaica', 'code' => 'JAM', 'phone_code' => '+1-876'],
            ['continent_id' => $northAmerica->id, 'name' => 'Costa Rica', 'code' => 'CRI', 'phone_code' => '+506'],
            ['continent_id' => $northAmerica->id, 'name' => 'Panama', 'code' => 'PAN', 'phone_code' => '+507'],
            ['continent_id' => $northAmerica->id, 'name' => 'Guatemala', 'code' => 'GTM', 'phone_code' => '+502'],
            ['continent_id' => $northAmerica->id, 'name' => 'Honduras', 'code' => 'HND', 'phone_code' => '+504'],
            ['continent_id' => $northAmerica->id, 'name' => 'Nicaragua', 'code' => 'NIC', 'phone_code' => '+505'],
            ['continent_id' => $northAmerica->id, 'name' => 'Dominican Republic', 'code' => 'DOM', 'phone_code' => '+1-809'],

            // -------------------- SOUTH AMERICA --------------------
            ['continent_id' => $southAmerica->id, 'name' => 'Brazil', 'code' => 'BRA', 'phone_code' => '+55'],
            ['continent_id' => $southAmerica->id, 'name' => 'Argentina', 'code' => 'ARG', 'phone_code' => '+54'],
            ['continent_id' => $southAmerica->id, 'name' => 'Chile', 'code' => 'CHL', 'phone_code' => '+56'],
            ['continent_id' => $southAmerica->id, 'name' => 'Colombia', 'code' => 'COL', 'phone_code' => '+57'],
            ['continent_id' => $southAmerica->id, 'name' => 'Peru', 'code' => 'PER', 'phone_code' => '+51'],
            ['continent_id' => $southAmerica->id, 'name' => 'Venezuela', 'code' => 'VEN', 'phone_code' => '+58'],
            ['continent_id' => $southAmerica->id, 'name' => 'Ecuador', 'code' => 'ECU', 'phone_code' => '+593'],
            ['continent_id' => $southAmerica->id, 'name' => 'Uruguay', 'code' => 'URY', 'phone_code' => '+598'],
            ['continent_id' => $southAmerica->id, 'name' => 'Bolivia', 'code' => 'BOL', 'phone_code' => '+591'],
            ['continent_id' => $southAmerica->id, 'name' => 'Paraguay', 'code' => 'PRY', 'phone_code' => '+595'],
            ['continent_id' => $southAmerica->id, 'name' => 'Suriname', 'code' => 'SUR', 'phone_code' => '+597'],
            ['continent_id' => $southAmerica->id, 'name' => 'Guyana', 'code' => 'GUY', 'phone_code' => '+592'],

            // -------------------- OCEANIA --------------------
            ['continent_id' => $oceania->id, 'name' => 'Australia', 'code' => 'AUS', 'phone_code' => '+61'],
            ['continent_id' => $oceania->id, 'name' => 'New Zealand', 'code' => 'NZL', 'phone_code' => '+64'],
            ['continent_id' => $oceania->id, 'name' => 'Fiji', 'code' => 'FJI', 'phone_code' => '+679'],
            ['continent_id' => $oceania->id, 'name' => 'Papua New Guinea', 'code' => 'PNG', 'phone_code' => '+675'],
            ['continent_id' => $oceania->id, 'name' => 'Samoa', 'code' => 'WSM', 'phone_code' => '+685'],
            ['continent_id' => $oceania->id, 'name' => 'Tonga', 'code' => 'TON', 'phone_code' => '+676'],
            ['continent_id' => $oceania->id, 'name' => 'Solomon Islands', 'code' => 'SLB', 'phone_code' => '+677'],
            ['continent_id' => $oceania->id, 'name' => 'Vanuatu', 'code' => 'VUT', 'phone_code' => '+678'],
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
