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
        Schema::table('user_profiles', function (Blueprint $table) {
            $table->string('normalized_full_name')->nullable()->index('idx_normalized_full_name');
            $table->string('soundex_name', 10)->nullable()->index('idx_soundex_name');
        });
    }

    public function down(): void
    {
        Schema::table('user_profiles', function (Blueprint $table) {
            $table->dropIndex('idx_normalized_full_name');
            $table->dropIndex('idx_soundex_name');
            $table->dropColumn(['normalized_full_name', 'soundex_name']);
        });
    }
};
