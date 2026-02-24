<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

/**
 * Seeds the institute_system pivot table (many-to-many).
 *
 * Each LIGO-India system is mapped to the real institutes that actively
 * contribute to that area. Requires InstituteSeeder and SystemSeeder
 * to have already run.
 *
 * To add or remove a link, edit the $map array below — no other file needs
 * to be touched.
 */
class InstituteSystemSeeder extends Seeder
{
    public function run(): void
    {
        $now = Carbon::now();

        // Fetch IDs keyed by code (dynamic — works after any migrate:fresh)
        $instIds   = DB::table('institutes')->pluck('id', 'code');
        $systemIds = DB::table('systems')->pluck('id', 'code');

        /**
         * Map: system_code => [institute_code, ...]
         *
         * Edit this array to change the many-to-many assignments.
         * All codes must match what is in the institutes and systems tables.
         */
        $map = [
            'INTSTR'   => ['DCSEM', 'IPR', 'IUCAA', 'RRCAT'],
            'OPTSYS'   => ['RRCAT', 'IPR', 'IISER-PUNE', 'IIT-BOMBAY', 'IIT-MADRAS'],
            'VACSYS'   => ['RRCAT', 'IPR', 'CGCRI', 'IIT-GANDHINAGAR', 'IUCAA'],
            'SEISCTRL' => ['IUCAA', 'IPR', 'RRCAT', 'IIT-BOMBAY', 'IIT-MADRAS', 'IISER-PUNE'],
            'DATCTRL'  => ['IUCAA', 'CMI', 'ICTS-TIFR', 'TIFR', 'IIT-GANDHINAGAR', 'IIT-HYDERABAD'],
            'THRMWFC'  => ['RRCAT', 'IPR', 'IISER-KOLKATA', 'IIT-HYDERABAD', 'IISER-PUNE'],
            'DETINF'   => ['DCSEM', 'IPR', 'IUCAA', 'RRCAT', 'GVC'],
            'COLSYS'   => ['IUCAA', 'CMI', 'ICTS-TIFR', 'TIFR', 'NIT-CALICUT', 'SINP', 'IIT-BOMBAY'],
        ];

        $rows = 0;

        foreach ($map as $sysCode => $instCodes) {
            $systemId = $systemIds[$sysCode] ?? null;
            if (!$systemId) {
                $this->command->warn("  System '{$sysCode}' not found — skipped.");
                continue;
            }

            foreach ($instCodes as $instCode) {
                $instId = $instIds[$instCode] ?? null;
                if (!$instId) {
                    $this->command->warn("  Institute '{$instCode}' not found — skipped.");
                    continue;
                }

                DB::table('institute_system')->insert([
                    'institute_id' => $instId,
                    'system_id'    => $systemId,
                    'created_at'   => $now,
                    'updated_at'   => $now,
                ]);
                $rows++;
            }
        }

        $this->command->info('success ' . $rows . ' institute_system pivot rows seeded.');
    }
}
