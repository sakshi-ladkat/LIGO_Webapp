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
            $table->dropColumn('id_card_review_requested_by');
        });
        Schema::table('applications', function (Blueprint $table) {
            $table->string('id_card_review_requested_by', 36)->nullable()->after('paused_workflow_step');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn('id_card_review_requested_by');
        });
        Schema::table('applications', function (Blueprint $table) {
            $table->unsignedBigInteger('id_card_review_requested_by')->nullable()->after('paused_workflow_step');
        });
    }
};
