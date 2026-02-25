<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_education', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->string('degree_level');
            $table->string('degree_title');
            $table->string('specialization')->nullable();
            $table->string('institute_name');
            $table->string('institute_country');
            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->string('grading_system');
            $table->string('grade_value');
            $table->boolean('is_current')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_education');
    }
};
