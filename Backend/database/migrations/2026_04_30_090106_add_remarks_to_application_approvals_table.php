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
        Schema::table('application_approvals', function (Blueprint $table) {
            $table->text('remarks')->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('application_approvals', function (Blueprint $table) {
            $table->dropColumn('remarks');
        });
    }
};
