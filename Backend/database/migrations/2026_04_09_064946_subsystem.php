<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CREATE: subsystems
 * ───────────────────
 * A subsystem is a component within a system (e.g. "Pre-Isolator" within "ISI").
 * Each subsystem belongs to one parent system.
 *

 */
return new class extends Migration
{
    // ── Up ────────────────────────────────────────────────────────────────────
    public function up(): void
    {
        Schema::create('subsystems', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();               // Short identifier e.g. "PRE-ISO"
            $table->string('name');                         // Full subsystem name
            $table->string('type');                         // Type/classification
            $table->text('description')->nullable();

            // system_id: which parent system this subsystem belongs to
            $table->foreignId('system_id')
                ->constrained('systems')
                ->onDelete('cascade');

            $table->boolean('is_active')->default(true);
            $table->timestamps();

            // NOTE: subsystem_lead_id removed — see entity_assignments table for
            //       current and historical lead assignments.
        });
    }

    // ── Down ──────────────────────────────────────────────────────────────────
    public function down(): void
    {
        Schema::dropIfExists('subsystems');
    }
};
