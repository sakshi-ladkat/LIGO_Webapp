<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds an auto-increment primary key `id` to user_qualification so that
 * multiple qualification records can exist per user (history tracking).
 * The active qualification is the row where is_active = true.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_qualification', function (Blueprint $table) {
            // Add id as the first column and make it the PK
            $table->id()->first();
        });
    }

    public function down(): void
    {
        Schema::table('user_qualification', function (Blueprint $table) {
            $table->dropColumn('id');
        });
    }
};
