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

        // Insert Default Roles
        DB::table('roles')->insert([
            ['id' => 1, 'name' => 'Super Admin', 'slug' => 'super_admin', 'level' => 90, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'name' => 'Coordinator', 'slug' => 'coordinator', 'level' => 70, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 3, 'name' => 'LI-Coordinator', 'slug' => 'li_coordinator', 'level' => 65, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 4, 'name' => 'System Lead', 'slug' => 'system_lead', 'level' => 50, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 5, 'name' => 'Subsystem Lead', 'slug' => 'subsystem_lead', 'level' => 40, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 6, 'name' => 'Supervisor', 'slug' => 'supervisor', 'level' => 30, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 7, 'name' => 'User', 'slug' => 'user', 'level' => 10, 'created_at' => now(), 'updated_at' => now()],
        ]);

        Schema::create('user_roles', function (Blueprint $table) {
        $table->foreignUlid('user_id')
              ->references('user_id')->on('users')
              ->onUpdate('cascade')
              ->onDelete('cascade');
        $table->foreignId('role_id')
              ->constrained('roles')
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
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('roles');
    }
};
