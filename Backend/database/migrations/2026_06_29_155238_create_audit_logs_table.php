<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates the `audit_logs` table.
 *
 * Design Decisions:
 * ─────────────────
 * 1. APPEND-ONLY — Records are never updated. Every event = new row.
 * 2. SELECTIVE INDEXES — Only on frequently queried columns. Avoids
 *    degrading INSERT throughput with excessive index maintenance.
 * 3. NULLABLE FOREIGN KEYS — Logs must survive even if related records
 *    are deleted. No cascade deletes.
 * 4. requires_input is modular — a future NoSQL migration only needs to
 *    swap out the AuditLogService implementation, no other changes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            // ── Primary Key ───────────────────────────────────────────────────
            $table->id();

            // ── Contextual References (nullable — logs outlive their records) ─
            $table->unsignedBigInteger('application_id')->nullable();
            $table->unsignedBigInteger('request_id')->nullable();
            $table->char('user_id', 26)->nullable();      // ULID from users table

            // ── Event Description ─────────────────────────────────────────────
            $table->string('action', 100);                 // e.g. "approve", "reject", "login"
            $table->string('status', 50)->nullable();      // e.g. "success", "failed"
            $table->text('remarks')->nullable();            // Human-readable context
            $table->string('entity_type', 80)->nullable(); // e.g. "Application", "User"
            $table->string('entity_id')->nullable();       // The ID of the affected record
            $table->json('payload')->nullable();           // Extra structured data (old/new values)

            // ── Request Metadata ──────────────────────────────────────────────
            $table->string('ip_address', 45)->nullable();  // IPv4 + IPv6 compatible
            $table->text('user_agent')->nullable();

            // ── Timestamps ────────────────────────────────────────────────────
            // created_at is the primary audit timestamp; updated_at is intentionally
            // omitted — logs are immutable and must never be updated.
            $table->timestamp('created_at')->useCurrent()->index(); // idx_created_at

            // ── Selective Indexes for High-Frequency Queries ──────────────────
            $table->index('application_id', 'idx_application_id');
            $table->index('user_id',        'idx_user_id');
            $table->index('request_id',     'idx_request_id');
            $table->index('action',         'idx_action');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
