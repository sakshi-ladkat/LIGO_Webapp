<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Restructure the user ↔ registration_data relationship.
     *
     * New structure:
     *   users.registration_id  →  registration_data.id   (users owns the FK)
     *
     * Old structure (removed):
     *   registration_data.user_id  →  users.id
     */
    public function up(): void
    {
        // 1. Add registration_id FK to users table
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('registration_id')->nullable()->after('institute_id');
            $table->foreign('registration_id')
                  ->references('id')
                  ->on('registration_data')
                  ->onDelete('set null');
        });

        // 2. Migrate existing data: populate users.registration_id from registration_data.user_id
        \DB::statement('
            UPDATE users u
            JOIN registration_data rd ON rd.user_id = u.id
            SET u.registration_id = rd.id
        ');

        // 3. Drop the old user_id FK and column from registration_data
        Schema::table('registration_data', function (Blueprint $table) {
            // Drop foreign key first (Laravel naming convention: table_column_foreign)
            $table->dropForeign(['user_id']);
            $table->dropColumn('user_id');
        });
    }

    /**
     * Reverse the migration (restore old structure).
     */
    public function down(): void
    {
        // 1. Re-add user_id to registration_data
        Schema::table('registration_data', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->nullable()->after('institute_id');
            $table->foreign('user_id')
                  ->references('id')
                  ->on('users')
                  ->onDelete('set null');
        });

        // 2. Migrate data back
        \DB::statement('
            UPDATE registration_data rd
            JOIN users u ON u.registration_id = rd.id
            SET rd.user_id = u.id
        ');

        // 3. Drop registration_id from users
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['registration_id']);
            $table->dropColumn('registration_id');
        });
    }
};
