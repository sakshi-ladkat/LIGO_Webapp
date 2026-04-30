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
            $table->foreignUlid('id_card_approved_by')->nullable()->references('user_id')->on('users')->onUpdate('cascade')->onDelete('set null');
            $table->timestamp('id_card_approved_at')->nullable();
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
