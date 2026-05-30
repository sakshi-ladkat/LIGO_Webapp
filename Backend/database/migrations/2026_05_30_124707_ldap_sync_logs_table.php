<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('ldap_sync_logs', function (Blueprint $table) {
            $table->id();
            $table->uuid('batch_id')->unique();
            $table->enum('status', ['success', 'partial', 'failed', 'running'])->default('running');
            $table->integer('users_processed')->default(0);
            $table->integer('users_added')->default(0);
            $table->integer('users_updated')->default(0);
            $table->integer('users_failed')->default(0);
            $table->json('errors')->nullable();
            $table->integer('duration_ms')->nullable();
            $table->timestamp('started_at')->useCurrent();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('started_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ldap_sync_logs');
    }
};
