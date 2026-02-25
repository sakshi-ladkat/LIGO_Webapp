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
        Schema::create('access_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('system_name');
            $table->unsignedBigInteger('institute_id');
            $table->string('services')->nullable(); // comma separated HTC,HPC,GITLAB
            $table->date('start_date');
            $table->date('end_date');
            $table->string('status')->default('Pending User Request'); // 'Pending', 'Approved by Lead', etc
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->text('reason')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('access_requests');
    }
};
