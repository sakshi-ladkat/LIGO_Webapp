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
        Schema::create('users', function (Blueprint $table) {
            $table->ulid('user_id')->primary();
            $table->string('email')->unique();
            $table->string('username')->nullable()->unique();
            $table->enum('status', [
                'onboarding',
                'submitted',
                'pending-approval',
                'approved',
                'active',
                'deactivated',
                'declined'
            ])->default('onboarding');
            $table->rememberToken();
            $table->timestamps();
        });


        //Personal Information
        Schema::create('user_profiles', function (Blueprint $table) {
            $table->foreignUlid('user_id')
                ->references('user_id')->on('users')
                ->onUpdate('cascade')
                ->onDelete('cascade')
                ->unique();

            $table->string('title')->nullable();
            $table->string('first_name');
            $table->string('middle_name')->nullable();
            $table->string('last_name');
            $table->date('date_of_birth');
            $table->enum('gender', ['male', 'female', 'other', 'prefer-not-to-say'])->nullable();
            $table->timestamps();

        });

        //Qualification Information =
        Schema::create('user_qualification', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('user_id')
                ->references('user_id')->on('users')
                ->onUpdate('cascade')
                ->onDelete('cascade');
            //Qualification Information =
            $table->string('highest_qualification');
            $table->string('field_of_study');
            $table->string('university');
            $table->year('graduation_year');
            $table->unsignedTinyInteger('graduation_month')->default(5); // Default to May if not specified
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        //Contact Information
        Schema::create('user_contacts', function (Blueprint $table) {
            $table->foreignUlid('user_id')
                ->references('user_id')->on('users')
                ->onUpdate('cascade')
                ->onDelete('cascade');
            $table->string('continent_name');
            $table->string('country_name');
            $table->string('address_line_1');
            $table->string('address_line_2')->nullable();
            $table->string('address_line_3')->nullable();
            $table->string('city');
            $table->string('state');
            $table->string('postal_code');
            $table->string('country_code');
            $table->string('city_code');
            $table->string('phone_number');
            $table->string('fax_number');

            $table->json('additional_metadata')->nullable();
            $table->timestamps();


        });

        Schema::create('user_supervisors', function (Blueprint $table) {
            $table->foreignUlid('user_id')
                ->references('user_id')->on('users')
                ->onUpdate('cascade')
                ->onDelete('cascade');
            $table->foreignUlid('supervisor_id')
                ->references('user_id')->on('users')
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
        Schema::dropIfExists('user_affilation');
        Schema::dropIfExists('user_supervisors');
        Schema::dropIfExists('user_contacts');
        Schema::dropIfExists('user_qualification');
        Schema::dropIfExists('user_profiles');
        Schema::dropIfExists('users');
    }
};