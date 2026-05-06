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
        Schema::create('application_approvals', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('application_id');
            $table->unsignedBigInteger('workflow_step_id');
            $table->foreignUlid('approved_by')->nullable()->references('user_id')->on('users')->onDelete('set null');
            $table->enum('status', ['pending', 'approved', 'declined'])->default('pending');
            $table->json('recommended_services')->nullable();
            $table->text('remarks')->nullable();
            $table->string('duration')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->foreign('application_id')->references('id')->on('applications')->onDelete('cascade');
            $table->foreign('workflow_step_id')->references('workflow_step_id')->on('workflow_steps')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('application_approvals');
    }
};
