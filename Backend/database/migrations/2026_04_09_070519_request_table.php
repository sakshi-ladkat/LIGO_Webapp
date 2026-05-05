<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('requests', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('type', ['service_permission', 'modify_affiliation'])->default('service_permission');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('user_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('user_id')->references('user_id')->on('users')->onUpdate('cascade')->onDelete('cascade');
            $table->foreignId('request_id')->constrained('requests')->onUpdate('cascade')->onDelete('cascade');
            $table->boolean('is_active')->default(false);
            $table->timestamps();
        });

        // 2. WORKFLOWS TABLE
        Schema::create('workflows', function (Blueprint $table) {
            $table->id('workflow_id'); // PK
            $table->string('workflow_name');
            $table->text('workflow_description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('version')->default(1);
            $table->boolean('is_latest')->default(true);
            $table->timestamps();
        });

        // 3. WORKFLOW STEPS TABLE
        Schema::create('workflow_steps', function (Blueprint $table) {
            $table->id('workflow_step_id'); // PK
            $table->unsignedBigInteger('workflow_id'); // FK
            $table->integer('step_no'); // Order (1,2,3...)
            $table->unsignedBigInteger('role_id'); // Who handles this step
            $table->string('step_action');
            $table->string('status_name');
            $table->boolean('is_final_step')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('workflow_id')->references('workflow_id')->on('workflows')->onDelete('cascade');
            $table->foreign('role_id')->references('id')->on('roles')->onDelete('cascade');
            $table->unique(['workflow_id', 'step_no']);
        });

        // 4. WORKFLOW CATEGORY MAPPING TABLE
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

        // 5. APPLICATIONS TABLE
        Schema::create('applications', function (Blueprint $table) {
            $table->id();
            $table->string('application_id')->unique();
            $table->foreignUlid('user_id')->references('user_id')->on('users')->onUpdate('cascade')->onDelete('cascade');
            $table->unsignedBigInteger('request_id');
            $table->unsignedBigInteger('workflow_id');
            $table->string('id_card_path')->nullable();
            $table->unsignedBigInteger('current_step_id')->nullable();
            $table->string('status')->default('pending');
            $table->boolean('is_active')->default(true);
            $table->enum('ligo_member', ['yes', 'no'])->nullable();
            $table->string('approved_by')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->string('duration')->nullable();
            $table->unsignedBigInteger('assigned_system_id')->nullable();
            $table->unsignedBigInteger('assigned_subsystem_id')->nullable();
            $table->foreignUlid('id_card_approved_by')->nullable()->references('user_id')->on('users')->onUpdate('cascade')->onDelete('set null');
            $table->timestamp('id_card_approved_at')->nullable();
            $table->boolean('computing_services')->default(false);
            $table->timestamps();

            $table->foreign('request_id')->references('id')->on('requests')->onDelete('cascade');
            $table->foreign('workflow_id')->references('workflow_id')->on('workflows');
            $table->foreign('current_step_id')->references('workflow_step_id')->on('workflow_steps');
        });

        // 6. APPLICATION LOGS
        Schema::create('application_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('application_id');
            $table->unsignedBigInteger('workflow_step_id');
            $table->foreignUlid('action_by')->references('user_id')->on('users')->onDelete('cascade');
            $table->string('role')->nullable();
            $table->string('action');
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->foreign('application_id')->references('id')->on('applications')->onDelete('cascade');
            $table->foreign('workflow_step_id')->references('workflow_step_id')->on('workflow_steps')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('application_logs');
        Schema::dropIfExists('applications');
        Schema::dropIfExists('workflow_category_mappings');
        Schema::dropIfExists('workflow_steps');
        Schema::dropIfExists('workflows');
        Schema::dropIfExists('user_requests');
        Schema::dropIfExists('requests');
    }
};