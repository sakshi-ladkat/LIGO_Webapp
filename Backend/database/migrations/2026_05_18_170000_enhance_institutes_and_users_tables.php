<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Update institutes table
        Schema::table('institutes', function (Blueprint $table) {
            if (!Schema::hasColumn('institutes', 'normalized_name')) {
                $table->string('normalized_name')->nullable()->index();
            }
            if (!Schema::hasColumn('institutes', 'is_user_suggested')) {
                $table->boolean('is_user_suggested')->default(false);
            }
            if (!Schema::hasColumn('institutes', 'created_by')) {
                $table->foreignUlid('created_by')
                    ->nullable()
                    ->references('user_id')->on('users')
                    ->onDelete('set null');
            }
            if (!Schema::hasColumn('institutes', 'modified_by')) {
                $table->foreignUlid('modified_by')
                    ->nullable()
                    ->references('user_id')->on('users')
                    ->onDelete('set null');
            }
        });

        // Populate normalized_name for existing default institutes
        $institutes = DB::table('institutes')->get();
        foreach ($institutes as $inst) {
            $normalized = trim(preg_replace('/\s+/', ' ', strtolower($inst->name)));
            DB::table('institutes')->where('id', $inst->id)->update([
                'normalized_name' => $normalized
            ]);
        }

        // 2. Update users table
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'institute_id')) {
                $table->foreignId('institute_id')
                    ->nullable()
                    ->constrained('institutes')
                    ->onDelete('set null');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['institute_id']);
            $table->dropColumn('institute_id');
        });

        Schema::table('institutes', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropForeign(['modified_by']);
            $table->dropColumn(['normalized_name', 'is_user_suggested', 'created_by', 'modified_by']);
        });
    }
};
