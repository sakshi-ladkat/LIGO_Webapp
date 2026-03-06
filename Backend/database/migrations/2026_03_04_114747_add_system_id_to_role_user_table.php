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
        Schema::table('role_user', function (Blueprint $table) {
            $table->unsignedBigInteger('system_id')->nullable()->after('role_id');
            $table->unsignedBigInteger('sub_system_id')->nullable()->after('system_id');

            $table->foreign('system_id')->references('id')->on('systems')->onDelete('cascade');
            $table->foreign('sub_system_id')->references('id')->on('sub_systems')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('role_user', function (Blueprint $table) {
            $table->dropForeign(['system_id']);
            $table->dropForeign(['sub_system_id']);
            $table->dropColumn(['system_id', 'sub_system_id']);
        });
    }
};
