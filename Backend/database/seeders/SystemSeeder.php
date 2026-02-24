<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

/**
 * Seeds ONLY the systems table — no institute logic here.
 * Institute ↔ System links live in InstituteSystemSeeder.
 */
class SystemSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        $systems = [
            [
                'code'        => 'INTSTR',
                'name'        => 'Interferometer Structure',
                'description' => 'L-shaped vacuum chambers (4 km arms) with UHV to minimise scattering. Fabry-Perot arm cavities extend effective laser path length.',
            ],
            [
                'code'        => 'OPTSYS',
                'name'        => 'Optical Systems',
                'description' => '180 W PSL narrow-linewidth laser. 10 core optics mirrors on fused silica suspensions. Mode-cleaner cavity and mode-matching telescope.',
            ],
            [
                'code'        => 'VACSYS',
                'name'        => 'Vacuum System',
                'description' => '100 × 20 m beam tubes, BSC & HAM chambers with double O-ring seals and pumped annuli maintaining UHV.',
            ],
            [
                'code'        => 'SEISCTRL',
                'name'        => 'Seismic Isolation and Control',
                'description' => 'Multi-stage passive and active seismic isolation. Real-time servo control for mirror suspension and angular alignment.',
            ],
            [
                'code'        => 'DATCTRL',
                'name'        => 'Data Acquisition and Control',
                'description' => 'CDS real-time monitoring, feedback and GPS time-stamping. PEM sensor network for environmental monitoring.',
            ],
            [
                'code'        => 'THRMWFC',
                'name'        => 'Thermal and Wavefront Control',
                'description' => 'Hartmann wavefront sensors and CO₂-laser active thermal compensation to correct high-power optical aberrations.',
            ],
            [
                'code'        => 'DETINF',
                'name'        => 'Detector Infrastructure',
                'description' => 'Site civil works at Aundha, Hingoli, Maharashtra. Component testing and R&D labs at RRCAT and partner institutes.',
            ],
            [
                'code'        => 'COLSYS',
                'name'        => 'Collaborative Systems',
                'description' => 'LDAS @ IUCAA with ~225 TF compute. Tier-1 data centre for archival and high-throughput analysis.',
            ],
        ];

        foreach ($systems as $system) {
            DB::table('systems')->insert([
                'name'        => $system['name'],
                'code'        => $system['code'],
                'description' => $system['description'],
                'is_active'   => 1,
                'created_at'  => $now,
                'updated_at'  => $now,
            ]);
        }

        $this->command->info('success ' . count($systems) . ' systems seeded.');
    }
}