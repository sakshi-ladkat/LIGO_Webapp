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
    }

    public function down(): void
    {
        Schema::dropIfExists('entity_assignments');
    }
};
