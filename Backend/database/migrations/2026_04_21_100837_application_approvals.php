<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CREATE: application_approvals
 * ──────────────────────────────
 * Records each reviewer's decision for a specific workflow step on an application.
 * One row per (application × workflow_step) — updated in place as status changes.
 *


 */
return new class extends Migration
{
    // ── Up ────────────────────────────────────────────────────────────────────
    public function up(): void
    {
        Schema::create('application_approvals', function (Blueprint $table) {
            $table->id();

            $table->unsignedBigInteger('application_id');    // FK → applications.id
            $table->unsignedBigInteger('workflow_step_id');  // FK → workflow_steps.workflow_step_id

            // assigned_to: the specific user who must action this step (can be null if not dynamically assigned yet)
            $table->foreignUlid('assigned_to')
                ->nullable()
                ->references('user_id')->on('users')
                ->onDelete('set null');

            // Status of this step's review decision
            $table->enum('status', ['pending', 'approved', 'declined'])->default('pending');

            // JSON array of service IDs the reviewer recommends has been normalized to approval_services pivot table.
            $table->text('remarks')->nullable();             // Reviewer's notes or decline reason

            // duration: the approved duration for this step (e.g. "6 months").
            // Stored separately per step since duration may be negotiated at each level.
            $table->string('duration')->nullable();

            $table->timestamp('approved_at')->nullable();    // When the decision was recorded
            $table->timestamps();

            $table->foreign('application_id')
                ->references('id')->on('applications')
                ->onDelete('cascade');
            $table->foreign('workflow_step_id')
                ->references('workflow_step_id')->on('workflow_steps')
                ->onDelete('cascade');
        });
    }

    // ── Down ──────────────────────────────────────────────────────────────────
    public function down(): void
    {
        Schema::dropIfExists('application_approvals');
    }
};
