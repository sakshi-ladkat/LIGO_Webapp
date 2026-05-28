<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * CREATE TABLE : users, user_profiles, user_qualification, user_contacts, user_supervisors
 **/


return new class extends Migration {
    // ── Up ────────────────────────────────────────────────────────────────────
    public function up(): void
    {
        // ── 1. USERS ─────────────────────────────────────────────────────────
        // Authentication + lifecycle state table.
        // PK is a ULID (26-char base32) — globally unique, sortable, URL-safe.
        Schema::create('users', function (Blueprint $table) {
            $table->ulid('user_id')->primary();              // ULID PK — globally unique & time-sortable

            // ── Authentication ───────────────────────────────────────────────
            $table->string('email')->unique();               // Primary login identifier
            $table->string('username')->nullable()->unique(); // LDAP username assigned after provisioning

            // ── Account Lifecycle Status ─────────────────────────────────────
            // State machine for the onboarding-to-active journey:
            //   onboarding       → Account created; user filling registration form
            //   submitted        → Application submitted; awaiting review
            //   pending-approval → Under active admin review
            //   approved         → Approved; LDAP provisioning pending
            //   active           → Fully provisioned; can access resources
            //   deactivated      → Suspended by admin (reversible)
            //   declined         → Application formally declined

            $table->enum('status', [
                'onboarding',
                'submitted',
                'pending-approval',
                'approved',
                'active',
                'deactivated',
                'declined',
            ])->default('onboarding');


            // subsystem_id: denormalised quick-lookup for the subsystem this user leads.
            // Canonical assignment data lives in entity_assignments; this is a cache column.
            $table->unsignedBigInteger('subsystem_id')->nullable();

            $table->rememberToken();                             // Laravel "remember me" cookie token
            $table->timestamps();
        });

        // ── 2. USER PROFILES (Personal Information) ───────────────────────────
        // 1-to-1 extension of users. Separation keeps users focused on auth only.
        // unique() on user_id enforces the 1-to-1 constraint at DB level.
        Schema::create('user_profiles', function (Blueprint $table) {
            $table->foreignUlid('user_id')                   // FK → users.user_id (also acts as PK via unique)
                ->references('user_id')->on('users')
                ->onUpdate('cascade')
                ->onDelete('cascade')
                ->unique();

            $table->string('title')->nullable();             // Salutation e.g. "Dr.", "Prof."
            $table->string('first_name');
            $table->string('middle_name')->nullable();
            $table->string('last_name');
            $table->date('date_of_birth');                   // Required for identity verification

            $table->enum('gender', [
                'male',
                'female',
                'other',
                'prefer-not-to-say',
            ])->nullable();

            // ── Duplicate Detection Indexes ──────────────────────────────────
            // Derived from first+last name; stored for fast fuzzy-match queries.
            // Storing a derived value is acceptable here as it serves as a
            // performance-optimised search column, not a data-modeling concern.
            $table->string('normalized_full_name')           // Lowercase + trimmed full name
                ->nullable()
                ->index('idx_normalized_full_name');
            $table->string('soundex_name', 10)              // SOUNDEX phonetic key for name matching
                ->nullable()
                ->index('idx_soundex_name');

            $table->timestamps();
        });

        // ── 3. USER QUALIFICATION (Educational History) ───────────────────────
        // 1-to-many: a user may record multiple qualifications.
        // is_active = true marks the qualification used for the current application.
        Schema::create('user_qualification', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('user_id')
                ->references('user_id')->on('users')
                ->onUpdate('cascade')
                ->onDelete('cascade');

            $table->string('highest_qualification');         // Degree level: B.Sc., M.Sc., Ph.D.
            $table->string('field_of_study');                // Discipline e.g. "Astrophysics"
            $table->string('university');                    // Awarding institution (free text)
            $table->year('graduation_year');
            $table->unsignedTinyInteger('graduation_month')
                ->default(5);                                // Defaults to May (typical academic year end)

            $table->boolean('is_active')->default(true);     // True = currently active / latest record
            $table->timestamps();
        });

        // ── 4. USER CONTACTS (Address & Phone) ───────────────────────────────
        // 1-to-1 extension of users for contact/address data.
        //
        // 3NF FIX (vs. original migration):
        //   Original stored continent_name and country_name as plain strings,
        //   creating a transitive dependency: user → contact → continent_name → continent.
        //   Fixed by storing continent_id / country_id FK references instead.
        Schema::create('user_contacts', function (Blueprint $table) {
            $table->foreignUlid('user_id')
                ->references('user_id')->on('users')
                ->onUpdate('cascade')
                ->onDelete('cascade')
                ->unique();                                  // Enforces 1-to-1

            // ── Geographical Location (FK-based, 3NF compliant) ──────────────
            $table->unsignedBigInteger('continent_id');      // FK → continents.id (added later)
            $table->unsignedBigInteger('country_id');        // FK → countries.id (added later)

            // ── Address ──────────────────────────────────────────────────────
            $table->string('address_line_1');
            $table->string('address_line_2')->nullable();
            $table->string('address_line_3')->nullable();
            $table->string('city');
            $table->string('state');
            $table->string('postal_code');

            // ── Phone ────────────────────────────────────────────────────────
            $table->string('country_code');                  // International dialling prefix e.g. "+91"
            $table->string('city_code');                     // Local area/city code
            $table->string('phone_number');
            $table->string('fax_number')->nullable();

            $table->json('additional_metadata')->nullable(); // Flexible bag for future contact fields
            $table->timestamps();
        });

        // ── 5. USER SUPERVISORS (Self-referencing Supervisor Relationship) ────
        // Many-to-many on users. A user_id can have multiple supervisors over time;
        // is_active flags the current active supervisory link.
        Schema::create('user_supervisors', function (Blueprint $table) {
            $table->foreignUlid('user_id')                   // The supervised user
                ->references('user_id')->on('users')
                ->onUpdate('cascade')
                ->onDelete('cascade');
            $table->foreignUlid('supervisor_id')             // Their supervisor (also a user)
                ->references('user_id')->on('users')
                ->onUpdate('cascade')
                ->onDelete('cascade');
            $table->boolean('is_active')->default(false);    // Only one active supervisory link at a time
            $table->timestamps();
        });
    }

    // ── Down ──────────────────────────────────────────────────────────────────
    public function down(): void
    {
        Schema::dropIfExists('user_affilation');             // Created in categories migration; cascade-safe
        Schema::dropIfExists('user_supervisors');
        Schema::dropIfExists('user_contacts');
        Schema::dropIfExists('user_qualification');
        Schema::dropIfExists('user_profiles');
        Schema::dropIfExists('users');
    }
};