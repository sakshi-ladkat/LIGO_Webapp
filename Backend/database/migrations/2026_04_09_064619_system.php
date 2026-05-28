<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CREATE: systems
 * ────────────────
 * Represents a high-level LIGO-India detector system (e.g. "ISI", "SUS").
 * Each system belongs to one institute and can have one or more subsystems.
 *

 */
return new class extends Migration
{
    // ── Up ────────────────────────────────────────────────────────────────────
    public function up(): void
    {
        Schema::create('systems', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();               // Short identifier e.g. "ISI"
            $table->string('name');                         // Full system name
            $table->string('type');                         // Category / classification of the system
            $table->text('description')->nullable();

            // institute_id: which institute owns/operates this system
            $table->foreignId('institute_id')
                ->constrained('institutes')
                ->onDelete('cascade');

            $table->boolean('is_active')->default(true);
            $table->timestamps();

            // NOTE: system_lead_id removed — see entity_assignments table for
            //       current and historical lead assignments.
        });
    }

    // ── Down ──────────────────────────────────────────────────────────────────
    public function down(): void
    {
        Schema::dropIfExists('systems');
    }
};
