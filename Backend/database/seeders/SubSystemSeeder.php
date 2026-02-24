<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class SubSystemSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        // Fetch all system IDs keyed by code
        $systems = DB::table('systems')->pluck('id', 'code');

        $subSystems = [

            /* ── Interferometer Structure ───────────────────── */
            [
                'system_id'   => $systems['INTSTR'],
                'name'        => 'L-Shaped Vacuum Arms',
                'code'        => 'LSVA',
                'description' => '4 km interferometer arms — ultra-high vacuum chambers minimise laser beam scattering.',
            ],
            [
                'system_id'   => $systems['INTSTR'],
                'name'        => 'Fabry-Perot Arm Cavities',
                'code'        => 'FPARM',
                'description' => 'Enhanced optical cavities that increase effective laser path length and gravitational-wave sensitivity.',
            ],

            /* ── Optical Systems ────────────────────────────── */
            [
                'system_id'   => $systems['OPTSYS'],
                'name'        => 'Pre-Stabilised Laser',
                'code'        => 'PSL',
                'description' => '180 W narrow-linewidth solid-state laser with frequency and intensity stabilisation.',
            ],
            [
                'system_id'   => $systems['OPTSYS'],
                'name'        => 'Core Optics',
                'code'        => 'COREOPT',
                'description' => '10 interferometer mirrors (test masses, beam splitter, folding mirrors, recycling mirrors) suspended on fused silica fibers.',
            ],
            [
                'system_id'   => $systems['OPTSYS'],
                'name'        => 'Mode Cleaner',
                'code'        => 'MODECLN',
                'description' => 'Mode-cleaner cavity and mode-matching telescope for beam quality and pointing control.',
            ],

            /* ── Vacuum System ──────────────────────────────── */
            [
                'system_id'   => $systems['VACSYS'],
                'name'        => 'Beam Tubes',
                'code'        => 'BEAMTUBE',
                'description' => '100 × 20 m beam tube sections reinforced with vacuum and support stiffeners.',
            ],
            [
                'system_id'   => $systems['VACSYS'],
                'name'        => 'Basic Symmetric Chambers',
                'code'        => 'BSC',
                'description' => 'Optics-housing vacuum chambers with demountable flanges for maintenance access.',
            ],
            [
                'system_id'   => $systems['VACSYS'],
                'name'        => 'Horizontal Access Modules',
                'code'        => 'HAM',
                'description' => 'Maintenance access chambers with double O-ring seals and pumped annuli to maintain UHV.',
            ],

            /* ── Seismic Isolation and Control ──────────────── */
            [
                'system_id'   => $systems['SEISCTRL'],
                'name'        => 'Multi-Stage Seismic Isolation',
                'code'        => 'MSISO',
                'description' => 'Passive and active multi-stage stack isolation to dampen ground vibrations.',
            ],
            [
                'system_id'   => $systems['SEISCTRL'],
                'name'        => 'Active Feedback Control',
                'code'        => 'AFC',
                'description' => 'Real-time servo control for mirror suspension, alignment, and angular stabilisation.',
            ],

            /* ── Data Acquisition and Control ───────────────── */
            [
                'system_id'   => $systems['DATCTRL'],
                'name'        => 'Control and Data System',
                'code'        => 'CDS',
                'description' => 'Real-time monitoring, feedback control, and GPS time-stamping for the full detector.',
            ],
            [
                'system_id'   => $systems['DATCTRL'],
                'name'        => 'Physical Environment Monitoring',
                'code'        => 'PEM',
                'description' => 'Sensor network tracking temperature, pressure, magnetic fields, and seismic activity.',
            ],

            /* ── Thermal and Wavefront Control ──────────────── */
            [
                'system_id'   => $systems['THRMWFC'],
                'name'        => 'Hartmann Wavefront Sensors',
                'code'        => 'HWS',
                'description' => 'Monitor thermal distortions in high-power optics and provide correction signals.',
            ],
            [
                'system_id'   => $systems['THRMWFC'],
                'name'        => 'Thermal Compensation System',
                'code'        => 'TCS',
                'description' => 'Active CO₂-laser heating to correct thermally induced optical aberrations.',
            ],

            /* ── Detector Infrastructure ────────────────────── */
            [
                'system_id'   => $systems['DETINF'],
                'name'        => 'Civil Infrastructure',
                'code'        => 'CIVIL',
                'description' => 'Site construction and facilities at Aundha village, Hingoli, Maharashtra — managed by DCSEM, IPR, IUCAA, and RRCAT.',
            ],
            [
                'system_id'   => $systems['DETINF'],
                'name'        => 'Training and Testing Facilities',
                'code'        => 'TRAIN',
                'description' => 'Detector component testing and R&D labs at RRCAT, Indore and partner institutes.',
            ],

            /* ── Collaborative Systems ──────────────────────── */
            [
                'system_id'   => $systems['COLSYS'],
                'name'        => 'LIGO Data Analysis System',
                'code'        => 'LDAS',
                'description' => 'IUCAA-hosted computing cluster with ~225 TF peak computing power for gravitational-wave data analysis.',
            ],
            [
                'system_id'   => $systems['COLSYS'],
                'name'        => 'Tier-1 Data Centre',
                'code'        => 'T1DC',
                'description' => 'Planned expansion data centre for long-term archival and high-throughput analysis.',
            ],
        ];

        foreach ($subSystems as $sub) {
            DB::table('sub_systems')->updateOrInsert(
                ['code' => $sub['code']],
                [
                    'system_id'   => $sub['system_id'],
                    'name'        => $sub['name'],
                    'description' => $sub['description'],
                    'is_active'   => 1,
                    'created_at'  => $now,
                    'updated_at'  => $now,
                ]
            );
        }

        $this->command->info('success ' . count($subSystems) . ' sub-systems seeded.');
    }
}
