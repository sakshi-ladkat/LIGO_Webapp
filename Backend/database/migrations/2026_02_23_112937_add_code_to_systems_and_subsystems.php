<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('systems', function (Blueprint $table) {
            // Unique code per institute (e.g. "HRMS", "LMS")
            $table->string('code', 50)->nullable()->after('name');
            $table->unique(['institute_id', 'code'], 'systems_institute_code_unique');
        });

        Schema::table('sub_systems', function (Blueprint $table) {
            // Code within a system (e.g. "PAYROLL", "LEAVE")
            $table->string('code', 50)->nullable()->after('name');
            $table->unique(['system_id', 'code'], 'sub_systems_system_code_unique');
        });
    }

    public function down(): void
    {
        Schema::table('systems', function (Blueprint $table) {
            $table->dropUnique('systems_institute_code_unique');
            $table->dropColumn('code');
        });

        Schema::table('sub_systems', function (Blueprint $table) {
            $table->dropUnique('sub_systems_system_code_unique');
            $table->dropColumn('code');
        });
    }
};
