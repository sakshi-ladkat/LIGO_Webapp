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
        Schema::table('applications', function (Blueprint $table) {
            $table->string('duration')->nullable();
            $table->foreignUlid('assigned_subsystem_lead_id')->nullable()->references('user_id')->on('users');
            $table->foreignUlid('assigned_system_lead_id')->nullable()->references('user_id')->on('users');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropForeign(['assigned_subsystem_lead_id']);
            $table->dropForeign(['assigned_system_lead_id']);
            $table->dropColumn(['duration', 'assigned_subsystem_lead_id', 'assigned_system_lead_id']);
        });
    }
};
