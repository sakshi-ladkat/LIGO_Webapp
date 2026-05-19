<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('categories', function (Blueprint $table) {
            $table->id();

            $table->foreignId('parent_id')
                ->nullable()
                ->constrained('categories')
                ->onDelete('cascade');

            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Insert Parent Categories
        DB::table('categories')->insert([
            ['id' => 1, 'name' => 'Student', 'slug' => 'student', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'name' => 'Faculty', 'slug' => 'faculty', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 3, 'name' => 'Researcher / Scientist', 'slug' => 'researcher-scientist', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 4, 'name' => 'Staff', 'slug' => 'staff', 'created_at' => now(), 'updated_at' => now()],
        ]);

        Schema::create('user_affilation', function (Blueprint $table) {
            $table->foreignUlid('user_id')
                ->references('user_id')->on('users')
                ->onUpdate('cascade')
                ->onDelete('cascade');
            $table->foreignId('institute_id')
                ->constrained('institutes')
                ->onUpdate('cascade')
                ->onDelete('cascade');
            $table->foreignId('category_id')
                ->constrained('categories')
                ->onUpdate('cascade')
                ->onDelete('cascade');
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->string('id_card_path')->nullable();
            $table->boolean('is_active')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_affilation');
        Schema::dropIfExists('categories');

    }
};