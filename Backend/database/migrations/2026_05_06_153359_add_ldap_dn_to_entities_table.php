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
        Schema::table('institutes', function (Blueprint $table) {
            $table->string('ldap_dn')->nullable()->after('city');
            $table->boolean('has_li_coordinator')->default(0)->after('ldap_dn');
        });

        // Update existing four institutes that have a coordinator
        \Illuminate\Support\Facades\DB::table('institutes')
            ->whereIn('code', ['DCSEM', 'IPR', 'IUCAA', 'RRCAT'])
            ->update(['has_li_coordinator' => 1]);

        Schema::table('services', function (Blueprint $table) {
            $table->string('ldap_dn')->nullable()->after('description');
        });
        Schema::table('subservices', function (Blueprint $table) {
            $table->string('ldap_dn')->nullable()->after('description');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('institutes', function (Blueprint $table) {
            $table->dropColumn(['ldap_dn', 'has_li_coordinator']);
        });
        Schema::table('services', function (Blueprint $table) {
            $table->dropColumn('ldap_dn');
        });
        Schema::table('subservices', function (Blueprint $table) {
            $table->dropColumn('ldap_dn');
        });
    }
};
