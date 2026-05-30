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
        Schema::create('user_invitations', function (Blueprint $table) {
            $table->id();
            $table->string('email')->index();
            $table->string('token')->unique();
            $table->foreignUlid('invited_by')
                  ->references('user_id')->on('users')
                  ->onUpdate('cascade')
                  ->onDelete('cascade');
            $table->foreignUlid('invited_user_id')
                  ->nullable()
                  ->references('user_id')->on('users')
                  ->onUpdate('cascade')
                  ->onDelete('set null');
            $table->string('role')->nullable();
            $table->string('status')->default('pending');
            $table->timestamp('expires_at');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_invitations');
    }
};
