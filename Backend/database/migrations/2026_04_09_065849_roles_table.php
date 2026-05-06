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
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('level');
            $table->string('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('user_roles', function (Blueprint $table) {
        $table->foreignUlid('user_id')
              ->references('user_id')->on('users')
              ->onUpdate('cascade')
              ->onDelete('cascade');
        $table->foreignId('role_id')
              ->constrained('roles')
              ->onUpdate('cascade')
              ->onDelete('cascade');
          $table->primary(['user_id', 'role_id']);
        $table->boolean('is_active')->default(false);
          $table->boolean('is_default')->default(false);
          $table->index(['role_id', 'is_default']);
        $table->timestamps();
     });

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('roles');
    }
};
