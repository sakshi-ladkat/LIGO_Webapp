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
            $table->unsignedBigInteger('assigned_system_id')->nullable();
            $table->unsignedBigInteger('assigned_subsystem_id')->nullable();
            
            if (Schema::hasColumn('applications', 'assigned_system_lead_id')) {
                $table->dropForeign(['assigned_system_lead_id']);
                $table->dropColumn('assigned_system_lead_id');
            }
            if (Schema::hasColumn('applications', 'assigned_subsystem_lead_id')) {
                $table->dropForeign(['assigned_subsystem_lead_id']);
                $table->dropColumn('assigned_subsystem_lead_id');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->unsignedBigInteger('assigned_system_lead_id')->nullable();
            $table->unsignedBigInteger('assigned_subsystem_lead_id')->nullable();
            
            $table->dropColumn(['assigned_system_id', 'assigned_subsystem_id']);
        });
    }
};
