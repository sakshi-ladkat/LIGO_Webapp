<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CREATE: role_assignment_logs
 * ─────────────────────────────
 * Audit trail for every role change (assignment / removal) in the system.
 * Immutable append-only log.
 *

 * NOTE: The Schema::table calls that added columns to institutes and user_roles
 *       from the original migration have been MERGED into:
 *   → 2026_04_09_045814_institute_table.php  (institutes.has_li_coordinator)
 *   → 2026_04_09_065849_roles_table.php      (user_roles: institute_id, assigned_by)
 *                                             (the 'role' string column was DROPPED — 3NF fix)
 * This file now only creates the role_assignment_logs table.
 */
return new class extends Migration
{
    // ── Up ────────────────────────────────────────────────────────────────────
    public function up(): void
    {
        Schema::create('role_assignment_logs', function (Blueprint $table) {
            $table->id();

            // assigned_by: the admin who made the role change
            $table->foreignUlid('assigned_by')
                ->references('user_id')->on('users')
                ->onDelete('cascade');

            // user_id: the user whose role was changed
            $table->foreignUlid('user_id')
                ->references('user_id')->on('users')
                ->onDelete('cascade');

            $table->string('previous_role')->nullable();     // Role slug before the change (null = first assignment)
            $table->string('new_role');                      // Role slug after the change

            // institute_id: which institute context the role change is scoped to
            $table->foreignId('institute_id')
                ->nullable()
                ->constrained('institutes')
                ->onDelete('set null');

            $table->timestamps();
        });
    }

    // ── Down ──────────────────────────────────────────────────────────────────
    public function down(): void
    {
        Schema::dropIfExists('role_assignment_logs');
    }
};
