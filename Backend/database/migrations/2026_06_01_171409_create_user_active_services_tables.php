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
        Schema::create('user_active_services', function (Blueprint $table) {
            $table->id();
            $table->string('user_id', 36);
            $table->unsignedBigInteger('service_id');
            $table->timestamp('granted_at')->useCurrent();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('user_id')->references('user_id')->on('users')->onDelete('cascade');
            $table->foreign('service_id')->references('id')->on('services')->onDelete('cascade');
            $table->unique(['user_id', 'service_id']);
        });

        Schema::create('user_active_subservices', function (Blueprint $table) {
            $table->id();
            $table->string('user_id', 36);
            $table->unsignedBigInteger('subservice_id');
            $table->timestamp('granted_at')->useCurrent();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('user_id')->references('user_id')->on('users')->onDelete('cascade');
            $table->foreign('subservice_id')->references('id')->on('subservices')->onDelete('cascade');
            $table->unique(['user_id', 'subservice_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_active_subservices');
        Schema::dropIfExists('user_active_services');
    }
};
