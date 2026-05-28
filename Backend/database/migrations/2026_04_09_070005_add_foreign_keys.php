<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('institutes', function (Blueprint $table) {
            $table->foreign('created_by')->references('user_id')->on('users')->onDelete('set null');
            $table->foreign('modified_by')->references('user_id')->on('users')->onDelete('set null');
        });

        Schema::table('user_contacts', function (Blueprint $table) {
            $table->foreign('continent_id')->references('id')->on('continents')->onDelete('cascade');
            $table->foreign('country_id')->references('id')->on('countries')->onDelete('cascade');
        });
    }
    public function down(): void {
        Schema::table('user_contacts', function (Blueprint $table) {
            $table->dropForeign(['continent_id']);
            $table->dropForeign(['country_id']);
        });

        Schema::table('institutes', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropForeign(['modified_by']);
        });
    }
};
