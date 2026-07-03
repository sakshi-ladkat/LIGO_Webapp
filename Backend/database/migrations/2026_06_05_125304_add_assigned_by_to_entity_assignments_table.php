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
        Schema::table('entity_assignments', function (Blueprint $table) {
            $table->char('assigned_by', 26)->nullable()->after('is_active');
            
            // Optional: Foreign key constraint if you want strict referential integrity
            // $table->foreign('assigned_by')->references('user_id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('entity_assignments', function (Blueprint $table) {
            $table->dropColumn('assigned_by');
        });
    }
};
