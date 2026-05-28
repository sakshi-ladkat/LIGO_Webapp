<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CREATE: countries
 * ──────────────────
 * Lookup table for countries, grouped by continent via FK.
 * Part of the geographical hierarchy used in user_contacts:
 *   continents → countries → (user_contacts)
 *

 */
return new class extends Migration
{
    // ── Up ────────────────────────────────────────────────────────────────────
    public function up(): void
    {
        Schema::create('countries', function (Blueprint $table) {
            $table->id();

            // continent_id: which continent this country belongs to (FK → continents.id).
            // Storing the FK avoids repeating continent data inside each country row.
            $table->foreignId('continent_id')
                ->constrained('continents')
                ->onDelete('cascade');

            $table->string('name', 100);                     // Full country name e.g. "India"

            // code: ISO 3166-1 alpha-3 country code e.g. "IND".
            // Used as a stable, internationally recognised identifier.
            $table->string('code', 3)->unique();

            // country_code: international dialling prefix e.g. "+91".
            // This is an attribute of the country (depends on id only). ✓ 3NF
            $table->string('country_code', 10)->nullable();

            $table->boolean('is_active')->default(true);     // Allows soft-disabling without deletion
            $table->timestamps();

            $table->index('continent_id');                   // Speed up "all countries in continent X" queries
        });
    }

    // ── Down ──────────────────────────────────────────────────────────────────
    public function down(): void
    {
        Schema::dropIfExists('countries');
    }
};
