<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * CREATE: continents
 * ───────────────────
 * Lookup table for the seven geographical continents.
 * Used as the top level of the geographical hierarchy:
 *   continents → countries → (user_contacts)
 *

 */
return new class extends Migration
{
    // ── Up ────────────────────────────────────────────────────────────────────
    public function up(): void
    {
        Schema::create('continents', function (Blueprint $table) {
            $table->id()->primary();

            $table->string('name', 100)->unique();           // Full continent name e.g. "Asia"
            $table->string('code', 2)->unique();             // ISO 3166 2-letter code e.g. "AS"
            $table->boolean('is_active')->default(true);     // Allows soft-disabling without deletion
            $table->timestamps();
        });

        // ── Seed All Seven Continents ─────────────────────────────────────────
        DB::table('continents')->insert([
            ['name' => 'Africa',        'code' => 'AF', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Antarctica',    'code' => 'AN', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Asia',          'code' => 'AS', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Europe',        'code' => 'EU', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'North America', 'code' => 'NA', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'Oceania',       'code' => 'OC', 'created_at' => now(), 'updated_at' => now()],
            ['name' => 'South America', 'code' => 'SA', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    // ── Down ──────────────────────────────────────────────────────────────────
    public function down(): void
    {
        Schema::dropIfExists('continents');
    }
};
