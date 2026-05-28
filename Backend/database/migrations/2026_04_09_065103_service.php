<?php

namespace Database\Migrations;

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CREATE: services
 * ─────────────────
 * Computing and infrastructure services offered within a subsystem.
 * e.g. "LIGO Data Grid Access" within the "Computing" subsystem.
 *


 */
return new class extends Migration
{
    // ── Up ────────────────────────────────────────────────────────────────────
    public function up(): void
    {
        Schema::create('services', function (Blueprint $table) {
            $table->id();
            $table->string('name');                          // Human-readable service name
            $table->string('code');                          // Short identifier code
            $table->string('type');                          // Service category/type

            $table->text('description')->nullable();

            // ldap_dn: Distinguished Name in LDAP for this service's group.
            // Used to add users to the correct LDAP group upon approval.
            // e.g. "cn=ligo-data,ou=services,dc=ligo,dc=in"
            $table->string('ldap_dn')->nullable();

            // subsystem_id: which subsystem this service belongs to
            $table->foreignId('subsystem_id')
                ->constrained('subsystems')
                ->onDelete('cascade');

            $table->boolean('is_ligo')->default(false);      // True = LIGO-specific service
            $table->boolean('is_computing')->default(false); // True = computing/HPC service
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    // ── Down ──────────────────────────────────────────────────────────────────
    public function down(): void
    {
        Schema::dropIfExists('services');
    }
};
