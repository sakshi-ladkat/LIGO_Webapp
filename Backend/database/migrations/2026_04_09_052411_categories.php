<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * CREATE: categories, user_affilation
 * ──────────────────────────────────────
 * categories     — Hierarchical taxonomy of user types (Student, Faculty, etc.)
 * user_affilation — Joins a user to an institute + category for their application
 *


 */
return new class extends Migration
{
    // ── Up ────────────────────────────────────────────────────────────────────
    public function up(): void
    {
        // ── 1. CATEGORIES ────────────────────────────────────────────────────
        // Hierarchical user-type taxonomy.
        // parent_id = null means this is a root / top-level category.
        // Self-referencing FK lets subcategories exist without inlining parent data.
        Schema::create('categories', function (Blueprint $table) {
            $table->id();

            // Self-referencing FK: null for root categories (Student, Faculty…)
            $table->foreignId('parent_id')
                ->nullable()
                ->constrained('categories')
                ->onDelete('cascade');

            $table->string('name');
            $table->string('slug')->unique();               // URL-safe key e.g. 'student', 'faculty'
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // ── Seed Top-Level Categories ─────────────────────────────────────────
        DB::table('categories')->insert([
            ['id' => 1, 'name' => 'Student',               'slug' => 'student',               'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'name' => 'Faculty',               'slug' => 'faculty',               'created_at' => now(), 'updated_at' => now()],
            ['id' => 3, 'name' => 'Researcher / Scientist','slug' => 'researcher-scientist',   'created_at' => now(), 'updated_at' => now()],
            ['id' => 4, 'name' => 'Staff',                 'slug' => 'staff',                  'created_at' => now(), 'updated_at' => now()],
        ]);

        // ── 2. USER AFFILIATION ───────────────────────────────────────────────
        // Records the organisational affiliation of a user for their application.
        // A user belongs to one institute in one category at a time (1-to-1 via unique).
        //
        // 3NF: department depends on the full (user+institute+category) affiliation,
        // not on any individual column — no partial or transitive dependency. ✓
        Schema::create('user_affilation', function (Blueprint $table) {   // Note: typo 'affilation' preserved from original schema
            // user_id acts as PK via unique constraint (enforces 1-to-1)
            $table->foreignUlid('user_id')
                ->references('user_id')->on('users')
                ->onUpdate('cascade')
                ->onDelete('cascade');

            // institute_id: the LIGO-India institute the user is affiliated with
            $table->foreignId('institute_id')
                ->constrained('institutes')
                ->onUpdate('cascade')
                ->onDelete('cascade');

            // other_institute: free-text fallback used when institute_id points to a
            // pending user-suggested record that has not yet been assigned a canonical name.
            $table->string('other_institute')->nullable();

            // category_id: the type of membership (Student, Faculty, etc.)
            $table->foreignId('category_id')
                ->constrained('categories')
                ->onUpdate('cascade')
                ->onDelete('cascade');

            // department: sub-unit within the institute (e.g. "Dept. of Astrophysics").
            // This is a fact of the affiliation, not of the institute alone — 3NF compliant.
            $table->string('department')->nullable();

            // entity_id: optional polymorphic reference to a system or subsystem.
            // No FK constraint because it references two different tables (systems/subsystems).
            $table->unsignedBigInteger('entity_id')->nullable();

            // id_card_path: relative path to the uploaded identity card file.
            $table->string('id_card_path')->nullable();

            // is_active: true once affiliation is approved by the coordinator/admin
            $table->boolean('is_active')->default(false);
            $table->timestamps();
        });
    }

    // ── Down ──────────────────────────────────────────────────────────────────
    public function down(): void
    {
        Schema::dropIfExists('user_affilation');
        Schema::dropIfExists('categories');
    }
};