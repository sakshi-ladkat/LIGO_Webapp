<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Alter the applications table enum to include 'active' instead of 'completed'
        // To be safe, we add 'active' to the enum, update existing rows, then remove 'completed'
        DB::statement("ALTER TABLE applications MODIFY COLUMN status ENUM('draft', 'submitted', 'under_review', 'id_proof_pending', 'approved_by_li_coordinator', 'approved', 'provisioning_pending', 'completed', 'active', 'declined', 'reapplied') DEFAULT 'draft'");
        
        DB::table('applications')->where('status', 'completed')->update(['status' => 'active']);
        
        DB::statement("ALTER TABLE applications MODIFY COLUMN status ENUM('draft', 'submitted', 'under_review', 'id_proof_pending', 'approved_by_li_coordinator', 'approved', 'provisioning_pending', 'active', 'declined', 'reapplied') DEFAULT 'draft'");

        // 2. Create the renew_logs table
        Schema::create('renew_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('user_id')->references('user_id')->on('users')->onDelete('cascade');
            $table->foreignId('application_id')->constrained('applications')->onDelete('cascade');
            $table->timestamp('previous_expired_at')->nullable();
            $table->timestamp('new_expired_at')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('renew_logs');

        DB::statement("ALTER TABLE applications MODIFY COLUMN status ENUM('draft', 'submitted', 'under_review', 'id_proof_pending', 'approved_by_li_coordinator', 'approved', 'provisioning_pending', 'completed', 'active', 'declined', 'reapplied') DEFAULT 'draft'");
        DB::table('applications')->where('status', 'active')->update(['status' => 'completed']);
        DB::statement("ALTER TABLE applications MODIFY COLUMN status ENUM('draft', 'submitted', 'under_review', 'id_proof_pending', 'approved_by_li_coordinator', 'approved', 'provisioning_pending', 'completed', 'declined', 'reapplied') DEFAULT 'draft'");
    }
};
