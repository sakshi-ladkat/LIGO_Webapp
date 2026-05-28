<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CREATE: workflow_step_assignments
 * ──────────────────────────────────
 * Records explicit user assignments to a workflow step for a specific application.
 * Used when role_type = 'targeted' on a workflow_step — the admin assigns a named
 * user to review rather than relying on pool or dynamic resolution.
 *

 * NOTE: The Schema::table calls that added columns to applications and workflow_steps
 *       and users from this original migration have been MERGED into:
 *   → 2026_04_09_070519_request_table.php     (applications.current_assignee_id;
 *                                               workflow_steps: step_code, role_type, is_dynamic_assignment)
 *   → 0001_01_01_000000_create_users_table.php (users.subsystem_id)
 * This file now only creates the workflow_step_assignments table.
 */
return new class extends Migration
{
    // ── Up ────────────────────────────────────────────────────────────────────
    public function up(): void
    {
        // ── WORKFLOW STEP ASSIGNMENTS ─────────────────────────────────────────
        // Explicit user assignment for a given application's workflow step.
        // Multiple rows can exist per (application, step) if the assignment changes.
        Schema::create('workflow_step_assignments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('application_id');    // FK → applications.id
            $table->string('workflow_step_id');               // FK → workflow_steps.workflow_step_id (stored as string for flexibility)
            $table->string('assigned_user_id');               // FK → users.user_id (string ref)
            $table->string('assigned_by')->nullable();        // user_id of admin who made the assignment
            $table->timestamp('assigned_at')->useCurrent();   // When the assignment was made
            $table->timestamps();

            $table->index(['application_id', 'workflow_step_id']); // Fast lookup by application+step
            $table->index('assigned_user_id');                     // Fast lookup by assigned reviewer
        });
    }

    // ── Down ──────────────────────────────────────────────────────────────────
    public function down(): void
    {
        Schema::dropIfExists('workflow_step_assignments');
    }
};
