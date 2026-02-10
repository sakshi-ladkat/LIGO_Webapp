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
            $table->foreignId('continent_id')->constrained()->onDelete('cascade');
            $table->string('name', 100);
            $table->string('code', 3)->unique(); // ISO 3166-1 alpha-3 code
            $table->string('phone_code', 10)->nullable(); // e.g., +1, +91
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
