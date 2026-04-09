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
            $table->enum('status', [
                'onboarding',
                'submitted',
                'pending-approval',
                'approved',
                'active',
                'deactivated',
                'rejected'
            ])->default('onboarding');
            $table->rememberToken();
            $table->timestamps();
        });

        Schema::create('user_profiles', function (Blueprint $table) {
            $table->foreignUlid('user_id')
                ->references('user_id')->on('users')
                ->onUpdate('cascade')
                ->onDelete('cascade')
                ->unique();

            //Personal Information
            $table->string('title')->nullable();
            $table->string('first_name');
            $table->string('middle_name')->nullable();
            $table->string('last_name');
            $table->date('date_of_birth');
            $table->enum('gender', ['male', 'female', 'other', 'prefer-not-to-say'])->nullable();

            //Qualification Information =
            $table->string('highest_qualification');
            $table->string('field_of_study');
            $table->string('university');
            $table->year('graduation_year');

            //Contact Information
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
        Schema::dropIfExists('users');
        Schema::dropIfExists('user_profiles');
    }
};