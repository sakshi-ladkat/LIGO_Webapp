<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->enum('ligo_member', ['yes', 'no'])->nullable();
        });

        Schema::table('application_approvals', function (Blueprint $table) {
            $table->json('recommended_services')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn('ligo_member');
        });

        Schema::table('application_approvals', function (Blueprint $table) {
            $table->dropColumn('recommended_services');
        });
    }
};
