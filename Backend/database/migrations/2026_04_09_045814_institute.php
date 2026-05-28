<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * CREATE: institutes
 * ───────────────────
 * Research/academic institutions participating in the LIGO-India network.
 * An institute goes through an admin-review lifecycle before being made active.
 *


 */
return new class extends Migration
{
    // ── Up ────────────────────────────────────────────────────────────────────
    public function up(): void
    {
        Schema::create('institutes', function (Blueprint $table) {
            $table->id();

            // ── Identity ─────────────────────────────────────────────────────
            $table->string('name')->unique();                // Full official name
            $table->string('code')->unique()->nullable();    // Short identifier e.g. "IUCAA", "TIFR"
            $table->string('city')->nullable();              // City of the main campus

            // ── LDAP Integration ──────────────────────────────────────────────
            // Distinguished Name in the LDAP directory tree.
            // e.g. "ou=IUCAA,dc=ligo,dc=in"
            // Used when provisioning LDAP group membership for approved members.
            $table->string('ldap_dn')->nullable();

            // ── Lifecycle ─────────────────────────────────────────────────────
            // status: admin review state — 'pending', 'approved', 'rejected'
            $table->string('status')->default('pending');
            $table->boolean('is_active')->default(false);   // Only approved institutes are active

            // ── LI-Coordinator Flag ───────────────────────────────────────────
            // True if this institute has a designated LI-Coordinator.
            // When true, the li_coordinator workflow step is injected into the
            // approval pipeline for applicants from this institute.
            $table->boolean('has_li_coordinator')->default(false);

            // ── Duplicate Detection ───────────────────────────────────────────
            // Lowercase, whitespace-normalised version of name.
            // Populated on insert/update; used to detect duplicate institute
            // submissions from users before admin review.
            $table->string('normalized_name')->nullable()->index();

            // ── User-Suggested Flag ───────────────────────────────────────────
            // True when the record was suggested by an applicant (not seeded by admin).
            // Such institutes remain inactive until an admin approves them.
            $table->boolean('is_user_suggested')->default(false);

            // ── Audit Columns ─────────────────────────────────────────────────
            // Track which admin created or last modified this institute record.
            $table->ulid('created_by')->nullable();
            $table->ulid('modified_by')->nullable();

            $table->timestamps();
        });

        // ── Seed Default Institutes ───────────────────────────────────────────
        DB::table('institutes')->insert([
            [
                'name'            => 'Inter-University Centre for Astronomy and Astrophysics',
                'code'            => 'IUCAA',
                'city'            => 'Pune',
                'status'          => 'approved',
                'is_active'       => true,
                'has_li_coordinator' => true,
                'normalized_name' => 'inter-university centre for astronomy and astrophysics',
                'created_at'      => now(), 'updated_at' => now(),
            ],
            [
                'name'            => 'Institute for Plasma Research',
                'code'            => 'IPR',
                'city'            => 'Gandhinagar',
                'status'          => 'approved',
                'is_active'       => true,
                'has_li_coordinator' => true,
                'normalized_name' => 'institute for plasma research',
                'created_at'      => now(), 'updated_at' => now(),
            ],
            [
                'name'            => 'Raja Ramanna Centre for Advanced Technology',
                'code'            => 'RRCAT',
                'city'            => 'Indore',
                'status'          => 'approved',
                'is_active'       => true,
                'has_li_coordinator' => true,
                'normalized_name' => 'raja ramanna centre for advanced technology',
                'created_at'      => now(), 'updated_at' => now(),
            ],
            [
                'name'            => 'Tata Institute of Fundamental Research',
                'code'            => 'TIFR',
                'city'            => 'Mumbai',
                'status'          => 'approved',
                'is_active'       => true,
                'has_li_coordinator' => false,
                'normalized_name' => 'tata institute of fundamental research',
                'created_at'      => now(), 'updated_at' => now(),
            ],
        ]);
    }

    // ── Down ──────────────────────────────────────────────────────────────────
    public function down(): void
    {
        Schema::dropIfExists('institutes');
    }
};
