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
        Schema::create('continents', function (Blueprint $table) {
            $table->id()->primary();
            $table->string('name',100)->unique();
            $table->string('code',2)->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // Insert Default Continents
        DB::table('continents')->insert([
            ['id' => 1, 'name' => 'Africa', 'code' => 'AF', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 2, 'name' => 'Antarctica', 'code' => 'AN', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 3, 'name' => 'Asia', 'code' => 'AS', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 4, 'name' => 'Europe', 'code' => 'EU', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 5, 'name' => 'North America', 'code' => 'NA', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 6, 'name' => 'Oceania', 'code' => 'OC', 'created_at' => now(), 'updated_at' => now()],
            ['id' => 7, 'name' => 'South America', 'code' => 'SA', 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('continents');
    }
};
