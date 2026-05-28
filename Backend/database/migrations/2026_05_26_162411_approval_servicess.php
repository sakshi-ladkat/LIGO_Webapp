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
        Schema::create('approval_services', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('approval_id');
            $table->unsignedBigInteger('service_id');
            $table->timestamps();

            $table->foreign('approval_id')->references('id')->on('application_approvals')->onDelete('cascade');
            $table->foreign('service_id')->references('id')->on('services')->onDelete('cascade');
            
            // Ensure unique pairs
            $table->unique(['approval_id', 'service_id']);
        });

        Schema::create('approval_subservices', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('approval_id');
            $table->unsignedBigInteger('subservice_id');
            $table->timestamps();

            $table->foreign('approval_id')->references('id')->on('application_approvals')->onDelete('cascade');
            $table->foreign('subservice_id')->references('id')->on('subservices')->onDelete('cascade');
            
            // Ensure unique pairs
            $table->unique(['approval_id', 'subservice_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('approval_subservices');
        Schema::dropIfExists('approval_services');
    }
};
