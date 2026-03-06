<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_education', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('is_current');
        });

        Schema::table('user_affiliations', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('end_date');
        });
    }

    public function down(): void
    {
        Schema::table('user_education', function (Blueprint $table) {
            $table->dropColumn('is_active');
        });

        Schema::table('user_affiliations', function (Blueprint $table) {
            $table->dropColumn('is_active');
        });
    }
};
