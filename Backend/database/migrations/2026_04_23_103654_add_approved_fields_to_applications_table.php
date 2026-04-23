<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->string('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
        });

        Schema::table('application_logs', function (Blueprint $table) {
            if (!Schema::hasColumn('application_logs', 'role')) {
                $table->string('role')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn(['approved_by', 'approved_at']);
        });

        Schema::table('application_logs', function (Blueprint $table) {
            $table->dropColumn('role');
        });
    }
};
