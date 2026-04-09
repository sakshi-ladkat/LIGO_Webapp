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
        Schema::create('requests', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('type', ['service_permission', 'modify_affiliation'])->default('service_permission');
            $table->timestamps();
        });

        Schema::create('user_requests', function (Blueprint $table) {
            $table->foreignUlid('user_id')
                  ->references('user_id')->on('users')
                  ->onUpdate('cascade')
                  ->onDelete('cascade');
            $table->foreignId('request_id')
                  ->constrained('requests')
                  ->onUpdate('cascade')
                  ->onDelete('cascade');
            $table->boolean('is_active')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('requests');
        Schema::dropIfExists('user_requests');
    }
};
