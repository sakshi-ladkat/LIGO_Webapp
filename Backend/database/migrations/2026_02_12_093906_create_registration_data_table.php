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
        Schema::create('registration_data', function (Blueprint $table) {
            $table->id();
            $table->string('email')->unique();
            $table->foreignId('institute_id')->nullable()->constrained('institutes')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            
            $table->string('first_name')->nullable();
            $table->string('middle_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('suffix')->nullable();
            
            $table->string('address_line1')->nullable();
            $table->string('address_line2')->nullable();
            $table->string('address_line3')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('postal_code')->nullable();
            $table->string('continent')->nullable(); // Assuming this can be string or ID, loose typing
            $table->string('country')->nullable();
            
            $table->string('office_country_code')->nullable();
            $table->string('office_city_code')->nullable();
            $table->string('office_number')->nullable();
            $table->string('fax_number')->nullable();
            
            $table->string('status')->default('draft'); // draft, email_verified, password_set, completed
            $table->timestamp('email_verified_at')->nullable();
            $table->timestamp('password_set_at')->nullable();
            
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('registration_data');
    }
};
