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
        Schema::create('entity_assignments', function (Blueprint $table) {
            $table->id();
            $table->string('entity_type'); // 'system' or 'subsystem'
            $table->unsignedBigInteger('entity_id');
            $table->foreignUlid('user_id')->references('user_id')->on('users')->onDelete('cascade');
            $table->boolean('is_active')->default(true);
            $table->timestamp('assigned_at')->useCurrent();
            $table->timestamp('deactivated_at')->nullable();
            $table->timestamps();

            $table->index(['entity_type', 'entity_id', 'is_active']);
        });

        // Migrate existing leads
        $systems = DB::table('systems')->get();
        foreach ($systems as $s) {
            if ($s->system_lead_id) {
                DB::table('entity_assignments')->insert([
                    'entity_type' => 'system',
                    'entity_id'   => $s->id,
                    'user_id'     => $s->system_lead_id,
                    'is_active'   => true,
                    'assigned_at' => $s->created_at ?? now(),
                    'created_at'  => now(), 'updated_at' => now()
                ]);
            }
        }

        $subsystems = DB::table('subsystems')->get();
        foreach ($subsystems as $ss) {
            if ($ss->subsystem_lead_id) {
                DB::table('entity_assignments')->insert([
                    'entity_type' => 'subsystem',
                    'entity_id'   => $ss->id,
                    'user_id'     => $ss->subsystem_lead_id,
                    'is_active'   => true,
                    'assigned_at' => $ss->created_at ?? now(),
                    'created_at'  => now(), 'updated_at' => now()
                ]);
            }
        }

        // Cleanup original tables
        Schema::table('systems', function (Blueprint $table) {
            $table->dropForeign(['system_lead_id']);
            $table->dropColumn('system_lead_id');
        });

        Schema::table('subsystems', function (Blueprint $table) {
            $table->dropForeign(['subsystem_lead_id']);
            $table->dropColumn('subsystem_lead_id');
        });
    }

    public function down(): void
    {
        // To reverse, we'd need to add columns back and move data back
        Schema::table('systems', function (Blueprint $table) {
            $table->foreignUlid('system_lead_id')->nullable()->references('user_id')->on('users');
        });
        Schema::table('subsystems', function (Blueprint $table) {
            $table->foreignUlid('subsystem_lead_id')->nullable()->references('user_id')->on('users');
        });

        // Restore data (roughly)
        $assignments = DB::table('entity_assignments')->where('is_active', true)->get();
        foreach ($assignments as $a) {
            if ($a->entity_type === 'system') {
                DB::table('systems')->where('id', $a->entity_id)->update(['system_lead_id' => $a->user_id]);
            } else {
                DB::table('subsystems')->where('id', $a->entity_id)->update(['subsystem_lead_id' => $a->user_id]);
            }
        }

        Schema::dropIfExists('entity_assignments');
    }
};
