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
        Schema::create('institute_transfer_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->unsignedBigInteger('from_institute_id')->nullable(); 
            $table->unsignedBigInteger('to_institute_id');
            $table->string('status')->default('pending_current_li'); // 'pending_current_li', 'pending_target_li', 'approved', 'rejected'
            $table->foreign('from_institute_id')->references('id')->on('institutes')->onDelete('set null');
            $table->foreign('to_institute_id')->references('id')->on('institutes')->onDelete('cascade');
            $table->text('rejection_reason')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('institute_transfer_requests');
    }
};
