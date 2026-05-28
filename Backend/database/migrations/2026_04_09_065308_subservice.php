<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CREATE: subservices
 * ────────────────────
 * Sub-level services nested under a parent service.
 * e.g. "LIGO-T3 Grid" under the "LIGO Data Grid Access" service.
 *


 */
return new class extends Migration
{
    // ── Up ────────────────────────────────────────────────────────────────────
    public function up(): void
    {
        Schema::create('subservices', function (Blueprint $table) {
            $table->id();
            $table->string('name');                          // Human-readable subservice name
            $table->string('code');                          // Short identifier code
            $table->string('type');                          // Type/classification

            $table->text('description')->nullable();

            // ldap_dn: LDAP Distinguished Name for this subservice's group.
            $table->string('ldap_dn')->nullable();

            // service_id: parent service this subservice is part of
            $table->foreignId('service_id')
                ->constrained('services')
                ->onDelete('cascade');

            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    // ── Down ──────────────────────────────────────────────────────────────────
    public function down(): void
    {
        Schema::dropIfExists('subservices');
    }
};
