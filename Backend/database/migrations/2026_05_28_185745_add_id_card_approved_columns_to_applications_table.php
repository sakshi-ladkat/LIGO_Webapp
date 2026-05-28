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
            $table->char('id_card_approved_by', 26)->nullable()->after('is_id_approved');
            $table->timestamp('id_card_approved_at')->nullable()->after('id_card_approved_by');
            
            $table->foreign('id_card_approved_by')->references('user_id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('applications', function (Blueprint $table) {
            $table->dropForeign(['id_card_approved_by']);
            $table->dropColumn(['id_card_approved_by', 'id_card_approved_at']);
        });
    }
};
