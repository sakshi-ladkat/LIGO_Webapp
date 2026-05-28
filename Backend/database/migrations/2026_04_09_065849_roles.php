<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * CREATE: roles, user_roles
 * ──────────────────────────
 * roles      — Named role definitions with a numeric level for hierarchy
 * user_roles — Assignment of roles to users (M:M with extra metadata)
 *


 */
return new class extends Migration
{
    // ── Up ────────────────────────────────────────────────────────────────────
    public function up(): void
    {
        // ── 1. ROLES ──────────────────────────────────────────────────────────
        // Defines the named roles in the system. 'level' is a numeric rank
        // used for hierarchy checks (higher = more authority).
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name');                          // Display name e.g. "Super Admin"
            $table->string('slug')->unique();                // Machine key e.g. "super_admin"
            $table->string('level');                         // Numeric hierarchy level (90 = highest)
            $table->string('description')->nullable();       // Human-readable purpose description
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // ── Seed Default Roles ────────────────────────────────────────────────
        DB::table('roles')->insert([
            ['id' => 1, 'name' => 'Super Admin',    'slug' => 'super_admin',    'level' => 90, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'name' => 'Coordinator',    'slug' => 'coordinator',    'level' => 70, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 3, 'name' => 'LI-Coordinator', 'slug' => 'li_coordinator', 'level' => 65, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 4, 'name' => 'System Lead',    'slug' => 'system_lead',    'level' => 50, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 5, 'name' => 'Subsystem Lead', 'slug' => 'subsystem_lead', 'level' => 40, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 6, 'name' => 'Supervisor',     'slug' => 'supervisor',     'level' => 30, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 7, 'name' => 'User',           'slug' => 'user',           'level' => 10, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // ── 2. USER ROLES (Role Assignment Join Table) ─────────────────────────
        // Assigns one or more roles to a user.
        // is_default flags the role that represents the user's primary identity
        // (e.g. someone who is both 'supervisor' and 'user').
        Schema::create('user_roles', function (Blueprint $table) {
            $table->foreignUlid('user_id')
                ->references('user_id')->on('users')
                ->onUpdate('cascade')
                ->onDelete('cascade');

            $table->foreignId('role_id')
                ->constrained('roles')
                ->onUpdate('cascade')
                ->onDelete('cascade');

            // assigned_by: FK to the admin who created this assignment (audit trail).
            $table->foreignUlid('assigned_by')
                ->nullable()
                ->references('user_id')->on('users')
                ->onDelete('set null');

            $table->boolean('is_active')->default(false);   // Active = currently in effect
            $table->boolean('is_default')->default(false);  // True = primary/display role for this user

            // Composite index: quickly find all users with a default role, or all
            // assignments for a given role.
            $table->index(['role_id', 'is_default']);

            $table->timestamps();
        });
    }

    // ── Down ──────────────────────────────────────────────────────────────────
    public function down(): void
    {
        Schema::dropIfExists('user_roles');
        Schema::dropIfExists('roles');
    }
};
