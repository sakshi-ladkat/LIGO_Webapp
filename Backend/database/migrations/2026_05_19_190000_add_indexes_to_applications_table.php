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
        Schema::table('applications', function (Blueprint $table) {
            // Composite index for fast reapply and status queries per user
            $table->index(['user_id', 'status'], 'idx_applications_user_status');
            
            // Single index on status for fast filtering on dashboard queues
            $table->index('status', 'idx_applications_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropIndex('idx_applications_user_status');
            $table->dropIndex('idx_applications_status');
        });
    }
};
