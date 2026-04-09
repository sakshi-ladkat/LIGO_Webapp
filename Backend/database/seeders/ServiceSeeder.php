<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Service;
use Illuminate\Support\Facades\DB;

class ServiceSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
         $subsystems = DB::table('subsystems')->pluck('id', 'code');
            $services = [
                [
                    'subsystem_id' => $subsystems['HRD-CI'],
                    'code' => 'Web-Services',
                    'type' => 'Service',
                    'name' => 'Different Web Services',
                    'description' => 'Providing various web-based services to support the organization\'s operations, such as online portals, APIs, and other digital platforms.',
                ],
                [
                    'subsystem_id' => $subsystems['HRD-CI'],
                    'code' => 'LIGO',
                    'type' => 'Service',
                    'name' => 'LIGO',
                    'description' => 'Offering specialized services related to the Laser Interferometer Gravitational-Wave Observatory (LIGO), including data analysis, research support, and collaboration opportunities for scientists and researchers in the field of gravitational wave astronomy.',
                ],
                [
                    'subsystem_id' => $subsystems['HRD-CI'],
                    'code' => 'GW',
                    'type' => 'Service',
                    'name' => 'Gravitational Wave',
                    'description' => 'Providing services related to gravitational wave research, including data processing, analysis tools, and support for researchers working in the field of gravitational wave astronomy.',
                ],
                   [
                    'subsystem_id' => $subsystems['HRD-CI'],
                    'code' => 'Jupyterhub',
                    'type' => 'Service',
                    'name' => 'JupyterHub',
                    'description' => 'Providing services related to gravitational wave research, including data processing, analysis tools, and support for researchers working in the field of gravitational wave astronomy.',
                ],
                   [
                    'subsystem_id' => $subsystems['HRD-CI'],
                    'code' => 'Sysplics',
                    'type' => 'Service',
                    'name' => 'Sysplics',
                    'description' => 'Providing services related to gravitational wave research, including data processing, analysis tools, and support for researchers working in the field of gravitational wave astronomy.',
                ],
                  [
                    'subsystem_id' => $subsystems['HRD-CI'],
                    'code' => 'HPC',
                    'type' => 'Service',
                    'name' => 'HPC',
                    'description' => 'Providing high-performance computing (HPC) services to support research and computational needs of the organization, including access to powerful computing resources, technical support, and training for researchers and staff.',
                ],
                 [
                    'subsystem_id' => $subsystems['HRD-CI'],
                    'code' => 'HTC',
                    'type' => 'Service',
                    'name' => 'HTC',
                    'description' => 'Providing high-throughput computing (HTC) services to support research and computational needs of the organization, including access to distributed computing resources, technical support, and training for researchers and staff.',
                ]
            ];
    
            foreach ($services as $service) {
                Service::updateOrCreate(
                    ['code' => $service['code']],
                    $service
                );
            }
    
            $this->command->info('Services seeded successfully!');
    }
}
