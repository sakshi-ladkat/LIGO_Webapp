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
        Schema::table('user_affilation', function (Blueprint $table) {
            $table->string('department')->nullable()->after('category_id');
            $table->string('other_institute')->nullable()->after('institute_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('user_affilation', function (Blueprint $table) {
            $table->dropColumn(['department', 'other_institute']);
        });
    }
};
