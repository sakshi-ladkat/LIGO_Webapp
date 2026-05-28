<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CREATE: block_history
 * ──────────────────────
 * Single source of truth for user block/unblock state.
 * Immutable append-only log — one row per block or unblock event.
 *
 * 3NF Notes (& design rationale):
 *   • All attributes depend on id (PK). user_id and blocked_by are FK refs. ✓
 *   • action ('block'/'unblock') is an attribute of the event, not of the user. ✓
 *   • is_blocked / blocked_reason / blocked_at were intentionally NOT added to
 *     the users table — storing current block state there would duplicate data
 *     already derivable from this table (3NF violation).
 *     To check whether a user is currently blocked, query the latest row:
 *       SELECT action FROM block_history
 *       WHERE user_id = ? ORDER BY created_at DESC LIMIT 1
 *     If action = 'block' → blocked. No row or action = 'unblock' → not blocked.
 */
return new class extends Migration
{
    // ── Up ────────────────────────────────────────────────────────────────────
    public function up(): void
    {
        Schema::create('block_history', function (Blueprint $table) {
            $table->id();

            // user_id: the user whose access was blocked or unblocked
            $table->foreignUlid('user_id')
                ->references('user_id')->on('users')
                ->onDelete('cascade');

            // blocked_by: the admin who performed the block/unblock action
            $table->foreignUlid('blocked_by')
                ->references('user_id')->on('users')
                ->onDelete('cascade');

            $table->string('action');                        // 'block' or 'unblock'
            $table->text('reason')->nullable();              // Admin-provided reason for the action
            $table->timestamps();
        });
    }

    // ── Down ──────────────────────────────────────────────────────────────────
    public function down(): void
    {
        Schema::dropIfExists('block_history');
    }
};
