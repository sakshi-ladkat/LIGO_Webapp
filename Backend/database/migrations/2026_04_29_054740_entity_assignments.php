<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CREATE: entity_assignments
 * ───────────────────────────
 * Tracks which user is currently assigned as lead for a system or subsystem.
 * Replaces the original system_lead_id / subsystem_lead_id FK columns on those
 * tables, enabling a full assignment history (multiple rows, with is_active flag).
 *

 * Note on data migration:
 *   On a fresh install the systems/subsystems tables no longer have lead_id
 *   columns (they were removed in this same consolidation). The data-migration
 *   loop that existed in the original file is therefore omitted.
 *   On an existing installation this migration must NOT be re-run — the
 *   original migration already ran and migrated the data.
 */
return new class extends Migration
{
    // ── Up ────────────────────────────────────────────────────────────────────
    public function up(): void
    {
        Schema::create('entity_assignments', function (Blueprint $table) {
            $table->id();

            // entity_type: discriminator for polymorphic reference
            //   'system'    → refers to systems.id
            //   'subsystem' → refers to subsystems.id
            $table->string('entity_type');
            $table->unsignedBigInteger('entity_id');         // The ID in the referenced table

            // user_id: the user assigned as lead for this entity
            $table->foreignUlid('user_id')
                ->references('user_id')->on('users')
                ->onDelete('cascade');

            $table->boolean('is_active')->default(true);     // True = currently active assignment
            $table->timestamp('assigned_at')->useCurrent();  // When this assignment was made
            $table->timestamp('deactivated_at')->nullable();  // When the assignment ended (null = still active)

            $table->timestamps();

            // Composite index for the common query: "who is the active lead for entity X?"
            $table->index(['entity_type', 'entity_id', 'is_active']);
        });
    }

    // ── Down ──────────────────────────────────────────────────────────────────
    public function down(): void
    {
        Schema::dropIfExists('entity_assignments');
    }
};
