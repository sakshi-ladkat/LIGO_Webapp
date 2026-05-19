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
        Schema::create('institutes', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('code')->unique()->nullable();
            $table->string('city')->nullable();
            $table->string('status')->default('pending');
            $table->boolean('is_active')->default(false);
            $table->timestamps();
        });

        // Insert Default Institutes
        DB::table('institutes')->insert([
            ['id' => 1, 'name' => 'Inter-University Centre for Astronomy and Astrophysics', 'code' => 'IUCAA', 'city' => 'Pune', 'status' => 'approved', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'name' => 'Institute for Plasma Research', 'code' => 'IPR', 'city' => 'Gandhinagar', 'status' => 'approved', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 3, 'name' => 'Raja Ramanna Centre for Advanced Technology', 'code' => 'RRCAT', 'city' => 'Indore', 'status' => 'approved', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['id' => 4, 'name' => 'Tata Institute of Fundamental Research', 'code' => 'TIFR', 'city' => 'Mumbai', 'status' => 'approved', 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('institutes');
    }
};
