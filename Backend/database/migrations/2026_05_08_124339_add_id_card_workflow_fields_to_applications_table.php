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
            $table->unsignedBigInteger('paused_workflow_step')->nullable()->after('current_step_id');
            $table->unsignedBigInteger('id_card_review_requested_by')->nullable();
            $table->timestamp('id_card_review_requested_at')->nullable();
            $table->text('id_card_reupload_remarks')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn([
                'paused_workflow_step',
                'id_card_review_requested_by',
                'id_card_review_requested_at',
                'id_card_reupload_remarks'
            ]);
        });
    }
};
