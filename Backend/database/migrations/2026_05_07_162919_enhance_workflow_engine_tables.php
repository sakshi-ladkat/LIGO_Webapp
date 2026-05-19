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
        Schema::table('applications', function (Blueprint $table) {
            $table->string('current_assignee_id')->nullable()->after('current_step_id');
            $table->index('current_assignee_id');
        });

        Schema::table('workflow_steps', function (Blueprint $table) {
            $table->string('step_code')->nullable()->after('step_no');
            $table->string('role_type')->nullable()->after('role_id'); // e.g., 'pool', 'dynamic', 'targeted'
            $table->boolean('is_dynamic_assignment')->default(false)->after('role_type');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('subsystem_id')->nullable()->after('status');
        });

        Schema::create('workflow_step_assignments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('application_id');
            $table->string('workflow_step_id');
            $table->string('assigned_user_id');
            $table->string('assigned_by')->nullable();
            $table->timestamp('assigned_at')->useCurrent();
            $table->timestamps();

            $table->index(['application_id', 'workflow_step_id']);
            $table->index('assigned_user_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('workflow_step_assignments');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('subsystem_id');
        });

        Schema::table('workflow_steps', function (Blueprint $table) {
            $table->dropColumn(['step_code', 'role_type', 'is_dynamic_assignment']);
        });

        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn('current_assignee_id');
        });
    }
};
