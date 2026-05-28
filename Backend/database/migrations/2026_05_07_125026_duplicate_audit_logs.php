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
        Schema::create('duplicate_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->ulid('application_id')->index();
            $table->ulid('matched_application_id')->index();
            $table->string('reviewed_by')->nullable(); // Admin UID/Email
            $table->string('decision'); // e.g. continue, reject, merged
            $table->text('remarks')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('duplicate_audit_logs');
    }
};
