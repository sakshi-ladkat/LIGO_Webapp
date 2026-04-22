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
        Schema::create('countries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('continent_id')->constrained('continents')->onDelete('cascade');
            $table->string('name',100);
            $table->string('code',3)->unique();
            $table->string('country_code',10)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('continent_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('countries');
    }
};
