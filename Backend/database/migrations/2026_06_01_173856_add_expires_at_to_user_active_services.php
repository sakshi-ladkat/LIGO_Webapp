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
        Schema::table('user_active_services', function (Blueprint $table) {
            $table->timestamp('expires_at')->nullable()->after('is_active');
        });

        Schema::table('user_active_subservices', function (Blueprint $table) {
            $table->timestamp('expires_at')->nullable()->after('is_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('user_active_services', function (Blueprint $table) {
            $table->dropColumn('expires_at');
        });

        Schema::table('user_active_subservices', function (Blueprint $table) {
            $table->dropColumn('expires_at');
        });
    }
};
