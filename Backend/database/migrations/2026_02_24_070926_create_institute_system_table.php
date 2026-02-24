<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Move from systems.institute_id (one-to-many) to a proper
     * many-to-many pivot table so that a system can belong to
     * multiple institutes and vice-versa.
     */
    public function up(): void
    {
        // 1. Create the pivot table
        Schema::dropIfExists('institute_system');
        Schema::create('institute_system', function (Blueprint $table) {
            $table->id();
            $table->foreignId('institute_id')
                  ->constrained('institutes')
                  ->onDelete('cascade');
            $table->foreignId('system_id')
                  ->constrained('systems')
                  ->onDelete('cascade');
            $table->timestamps();

            // A system can only be linked once per institute
            $table->unique(['institute_id', 'system_id']);
        });

        // 2. Migrate existing data from systems.institute_id into the pivot
        if (Schema::hasColumn('systems', 'institute_id')) {
            $rows = \DB::table('systems')->whereNotNull('institute_id')->get();
            foreach ($rows as $system) {
                \DB::table('institute_system')->insertOrIgnore([
                    'institute_id' => $system->institute_id,
                    'system_id'    => $system->id,
                    'created_at'   => now(),
                    'updated_at'   => now(),
                ]);
            }

            // 3. Drop the old FK column from systems
            Schema::table('systems', function (Blueprint $table) {
                $table->dropForeign(['institute_id']);
                $table->dropIndex(['institute_id']);
                $table->dropColumn('institute_id');
            });
        }
    }

    public function down(): void
    {
        // Re-add the column and restore data (best-effort rollback)
        Schema::table('systems', function (Blueprint $table) {
            $table->foreignId('institute_id')
                  ->nullable()
                  ->constrained('institutes')
                  ->onDelete('cascade');
            $table->index('institute_id');
        });

        // Move pivot data back
        \DB::table('institute_system')->each(function ($row) {
            \DB::table('systems')
               ->where('id', $row->system_id)
               ->update(['institute_id' => $row->institute_id]);
        });

        Schema::dropIfExists('institute_system');
    }
};
