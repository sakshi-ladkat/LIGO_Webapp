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
        Schema::create('application_corrections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained('applications')->onDelete('cascade');
            $table->json('editable_fields')->nullable();
            $table->json('requested_documents')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamp('requested_at')->useCurrent();
            $table->string('requested_by')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });

        Schema::create('document_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_id')->constrained('applications')->onDelete('cascade');
            $table->string('field_name');
            $table->string('old_file_path')->nullable();
            $table->string('new_file_path');
            $table->string('uploaded_by')->nullable();
            $table->timestamp('uploaded_at')->useCurrent();
            $table->timestamps();
        });

        Schema::table('applications', function (Blueprint $table) {
            if (!Schema::hasColumn('applications', 'correction_cycle')) {
                $table->integer('correction_cycle')->default(0);
            }
            if (!Schema::hasColumn('applications', 'correction_requested_at')) {
                $table->timestamp('correction_requested_at')->nullable();
            }
            if (!Schema::hasColumn('applications', 'correction_requested_by')) {
                $table->string('correction_requested_by')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('document_versions');
        Schema::dropIfExists('application_corrections');
        Schema::table('applications', function (Blueprint $table) {
            $table->dropColumn(['correction_cycle', 'correction_requested_at', 'correction_requested_by']);
        });
    }
};
