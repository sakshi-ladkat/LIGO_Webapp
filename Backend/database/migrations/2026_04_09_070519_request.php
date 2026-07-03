<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // ── 1. REQUESTS ───────────────────────────────────────────────────────
        Schema::create('requests', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('type', ['service_permission', 'modify_affiliation'])->default('service_permission');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        // ── 2. USER REQUESTS ──────────────────────────────────────────────────
        Schema::create('user_requests', function (Blueprint $table) {
            $table->foreignUlid('user_id')->references('user_id')->on('users')->onUpdate('cascade')->onDelete('cascade');
            $table->foreignId('request_id')->constrained('requests')->onUpdate('cascade')->onDelete('cascade');
            $table->boolean('is_active')->default(false);
            $table->timestamps();
        });

        // ── 3. WORKFLOW CONFIGURATION TABLES ──────────────────────────────────
        Schema::create('workflow_actions', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->timestamps();
        });
        
        DB::table('workflow_actions')->insert([
            ['name' => 'Recommend', 'slug' => 'recommend', 'description' => 'Recommend for approval'],
            ['name' => 'Approve', 'slug' => 'approve', 'description' => 'Final approval'],
            ['name' => 'Approve Identity', 'slug' => 'approve_identity', 'description' => 'Approve user identity card'],
            ['name' => 'Reject', 'slug' => 'reject', 'description' => 'Reject application']
        ]);

        Schema::create('workflow_statuses', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->timestamps();
        });
        
        DB::table('workflow_statuses')->insert([
            ['name' => 'Awaiting Supervisor', 'slug' => 'awaiting_supervisor'],
            ['name' => 'Pending HPC', 'slug' => 'pending_hpc'],
            ['name' => 'Approved', 'slug' => 'approved'],
            ['name' => 'Rejected', 'slug' => 'rejected']
        ]);

        Schema::create('assignment_strategies', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->timestamps();
        });
        
        DB::table('assignment_strategies')->insert([
            ['name' => 'Pool', 'slug' => 'pool', 'description' => 'Any user with the role'],
            ['name' => 'Dynamic Lead', 'slug' => 'dynamic_lead', 'description' => 'Assigned based on entity lead'],
            ['name' => 'Targeted', 'slug' => 'targeted', 'description' => 'Targeted user assignment']
        ]);

        // ── 4. WORKFLOWS ──────────────────────────────────────────────────────
        Schema::create('workflows', function (Blueprint $table) {
            $table->id('workflow_id');
            $table->string('workflow_name');
            $table->text('workflow_description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('version')->default(1);
            $table->boolean('is_latest')->default(true);
            $table->timestamps();
        });

        // ── 5. WORKFLOW STEPS ─────────────────────────────────────────────────
        Schema::create('workflow_steps', function (Blueprint $table) {
            $table->id('workflow_step_id');
            $table->unsignedBigInteger('workflow_id');
            $table->integer('step_no');
            $table->string('step_code')->nullable();
            
            $table->unsignedBigInteger('role_id');
            $table->foreignId('status_id')->constrained('workflow_statuses');
            
            $table->boolean('is_final_step')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('workflow_id')->references('workflow_id')->on('workflows')->onDelete('cascade');
            $table->foreign('role_id')->references('id')->on('roles')->onDelete('cascade');
            $table->unique(['workflow_id', 'step_no']);
        });

        // ── 5A. WORKFLOW STEP ACTIONS (Many-to-Many) ─────────────────────────
        // A single workflow step can support multiple actions (e.g. Approve + Recommend).
        Schema::create('workflow_step_actions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('workflow_step_id');
            $table->unsignedBigInteger('action_id');
            $table->timestamps();

            $table->foreign('workflow_step_id')->references('workflow_step_id')->on('workflow_steps')->onDelete('cascade');
            $table->foreign('action_id')->references('id')->on('workflow_actions')->onDelete('cascade');
            $table->unique(['workflow_step_id', 'action_id']);
        });

        // ── 6. WORKFLOW TRANSITIONS ───────────────────────────────────────────
        Schema::create('workflow_transitions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('workflow_step_id');
            $table->unsignedBigInteger('action_id');
            $table->unsignedBigInteger('next_step_id')->nullable(); // Null if terminal
            $table->timestamps();
            
            $table->foreign('workflow_step_id')->references('workflow_step_id')->on('workflow_steps')->onDelete('cascade');
            $table->foreign('action_id')->references('id')->on('workflow_actions')->onDelete('cascade');
            $table->foreign('next_step_id')->references('workflow_step_id')->on('workflow_steps')->onDelete('set null');
        });

        // ── 7. WORKFLOW CATEGORY MAPPINGS ─────────────────────────────────────
        Schema::create('workflow_category_mappings', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('request_id');
            $table->unsignedBigInteger('category_id');
            $table->unsignedBigInteger('workflow_id');
            $table->timestamps();

            $table->foreign('request_id')->references('id')->on('requests')->onDelete('cascade');
            $table->foreign('category_id')->references('id')->on('categories')->onDelete('cascade');
            $table->foreign('workflow_id')->references('workflow_id')->on('workflows')->onDelete('cascade');
            $table->unique(['request_id', 'category_id']);
        });

        // ── 8. APPLICATIONS ───────────────────────────────────────────────────
        Schema::create('applications', function (Blueprint $table) {
            $table->id();
            $table->string('application_id')->unique();
            $table->foreignUlid('user_id')->references('user_id')->on('users')->onUpdate('cascade')->onDelete('cascade');
            $table->unsignedBigInteger('request_id');
            $table->unsignedBigInteger('workflow_id');
            $table->unsignedBigInteger('current_step_id')->nullable();
            $table->unsignedBigInteger('paused_workflow_step')->nullable();
            $table->string('current_assignee_id')->nullable()->index();
            $table->enum('status', ['draft', 'submitted', 'under_review', 'id_proof_pending', 'approved_by_li_coordinator', 'approved', 'provisioning_pending', 'completed', 'declined', 'reapplied'])->default('draft');
            $table->boolean('is_active')->default(true);

            $table->ulid('parent_application_id')->nullable()->index();
            $table->string('reapplied_from')->nullable();
            $table->json('profile_snapshot')->nullable();
            $table->integer('retry_attempt')->default(1);

            $table->timestamps();

            $table->foreign('request_id')->references('id')->on('requests')->onDelete('cascade');
            $table->foreign('workflow_id')->references('workflow_id')->on('workflows');
            $table->foreign('current_step_id')->references('workflow_step_id')->on('workflow_steps');
            
            $table->index(['user_id', 'status'], 'idx_applications_user_status');
            $table->index('status', 'idx_applications_status');
        });

        // ── 8A. APP ACTIVATION DETAILS ────────────────────────────────────────
        Schema::create('app_activation_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained('applications')->onDelete('cascade');
            
            $table->enum('ligo_member', ['yes', 'no'])->nullable();
            $table->enum('ligo_us_member', ['yes', 'no'])->nullable();
            $table->enum('ligo_india_member', ['yes', 'no'])->nullable();
            $table->string('duration')->nullable();
            $table->boolean('computing_services')->default(false);

            $table->unsignedBigInteger('assigned_system_id')->nullable();
            $table->unsignedBigInteger('assigned_subsystem_id')->nullable();
            $table->string('id_card_path')->nullable();
            $table->boolean('is_id_approved')->default(false);
            
            $table->char('id_card_approved_by', 26)->nullable();
            $table->timestamp('id_card_approved_at')->nullable();
            $table->timestamp('id_proof_requested_at')->nullable();

            $table->timestamps();

            $table->foreign('id_card_approved_by')->references('user_id')->on('users')->onDelete('set null');
        });

        // ── 8B. APP MODIFY DETAILS ────────────────────────────────────────────
        Schema::create('app_modify_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained('applications')->onDelete('cascade');
            
            $table->unsignedBigInteger('institute_id')->nullable();
            $table->unsignedBigInteger('category_id')->nullable();
            $table->string('other_institute')->nullable();
            $table->string('id_card_path')->nullable();

            $table->timestamps();
        });


        // ── 9. APPLICATION REJECTIONS ─────────────────────────────────────────
        Schema::create('application_rejections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained('applications')->onDelete('cascade');
            $table->string('rejection_type')->nullable();
            $table->text('rejection_reason')->nullable();
            $table->foreignUlid('rejected_by')->nullable()->references('user_id')->on('users')->onDelete('set null');
            $table->timestamp('rejected_at')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();
        });

        // ── 10. APPLICATION ID PROOF REVIEWS ──────────────────────────────────
        Schema::create('application_id_proof_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained('applications')->onDelete('cascade');
            $table->enum('review_status', ['pending', 'approved', 'reupload_requested'])->default('pending');
            $table->text('remarks')->nullable();
            $table->string('new_id_card_path', 500)->nullable();
            $table->foreignUlid('requested_by')->nullable()->references('user_id')->on('users')->onDelete('set null');
            $table->timestamp('requested_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });

        // ── 11. APPLICATION WORKFLOW LOGS ─────────────────────────────────────
        Schema::create('application_workflow_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('application_id');
            $table->unsignedBigInteger('workflow_step_id');
            $table->foreignUlid('action_by')->nullable()->references('user_id')->on('users')->onDelete('cascade');
            $table->string('role')->nullable();
            $table->string('previous_status')->nullable();
            $table->string('new_status')->nullable();
            $table->string('action');
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->foreign('application_id')->references('id')->on('applications')->onDelete('cascade');
            $table->foreign('workflow_step_id')->references('workflow_step_id')->on('workflow_steps')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('application_workflow_logs');
        Schema::dropIfExists('application_id_proof_reviews');
        Schema::dropIfExists('application_rejections');
        Schema::dropIfExists('app_modify_details');
        Schema::dropIfExists('app_activation_details');
        Schema::dropIfExists('applications');
        Schema::dropIfExists('workflow_category_mappings');
        Schema::dropIfExists('workflow_transitions');
        Schema::dropIfExists('workflow_steps');
        Schema::dropIfExists('workflows');
        Schema::dropIfExists('assignment_strategies');
        Schema::dropIfExists('workflow_statuses');
        Schema::dropIfExists('workflow_actions');
        Schema::dropIfExists('user_requests');
        Schema::dropIfExists('requests');
    }
};