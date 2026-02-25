<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('access_requests', function (Blueprint $table) {
            // Change approved_by from unsignedBigInteger → string (stores email of approver)
            $table->string('approved_by', 255)->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('access_requests', function (Blueprint $table) {
            $table->unsignedBigInteger('approved_by')->nullable()->change();
        });
    }
};
