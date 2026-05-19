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
            $table->integer('retry_attempt')->default(1);
            $table->ulid('parent_application_id')->nullable()->index();
            $table->string('rejection_type')->nullable(); // 'correction', 'final'
            $table->boolean('correction_required')->default(false);
            $table->text('rejection_reason')->nullable();
            $table->string('rejected_by')->nullable();
            $table->timestamp('rejected_at')->nullable();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->integer('retry_count')->default(0);
            $table->integer('admin_buffer_count')->default(0);
            $table->boolean('is_blocked')->default(false);
            $table->text('blocked_reason')->nullable();
            $table->timestamp('blocked_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn([
                'retry_attempt', 'parent_application_id', 'rejection_type', 
                'correction_required', 'rejection_reason', 'rejected_by', 'rejected_at'
            ]);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['retry_count', 'admin_buffer_count', 'is_blocked', 'blocked_reason', 'blocked_at']);
        });
    }
};
