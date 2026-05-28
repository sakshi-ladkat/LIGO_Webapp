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
        DB::statement("ALTER TABLE applications MODIFY COLUMN status ENUM('draft','submitted','under_review','id_proof_pending','approved','declined','reapplied') NOT NULL DEFAULT 'draft'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE applications MODIFY COLUMN status ENUM('draft','submitted','under_review','id_proof_pending','approved','declined') NOT NULL DEFAULT 'draft'");
    }
};
