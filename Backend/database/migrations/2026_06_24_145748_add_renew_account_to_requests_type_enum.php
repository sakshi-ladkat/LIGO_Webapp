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
        DB::statement("ALTER TABLE requests MODIFY COLUMN type ENUM('service_permission', 'modify_affiliation', 'renew_account') DEFAULT 'service_permission'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE requests MODIFY COLUMN type ENUM('service_permission', 'modify_affiliation') DEFAULT 'service_permission'");
    }
};
