<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Subservice;
use Illuminate\Support\Facades\DB;

class SubservicesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $services = DB::table('services')->pluck('id', 'code');
        $subservices = [
            [
                'service_id' => $services['Web-Services'],
                'code' => 'Alog',
                'name' => 'Alog',
                'type' => 'Subservice',
                'description' => 'Providing services related to Alog, a web-based application for managing and analyzing data, including technical support, training, and access to resources for users of the Alog platform.',
            ],
            [
                'service_id' => $services['Web-Services'],
                'code' => 'Gitlab',
                'name' => 'Gitlab',
                'type' => 'Subservice',
                'description' => 'Providing services related to Gitlab, a web-based application for managing and analyzing data, including technical support, training, and access to resources for users of the Gitlab platform.',
            ],
            [
                'service_id' => $services['Web-Services'],
                'code' => 'Sympa',
                'name' => 'Sympa',
                'type' => 'Subservice',
                'description' => 'Providing services related to Sympa, a web-based application for managing and analyzing data, including technical support, training, and access to resources for users of the Sympa platform.',
            ]
        ];

        foreach ($subservices as $subservice) {
            Subservice::updateOrCreate(
            ['code' => $subservice['code']],
                $subservice
            );
        }

        $this->command->info('Subservices seeded successfully!');
    }
}