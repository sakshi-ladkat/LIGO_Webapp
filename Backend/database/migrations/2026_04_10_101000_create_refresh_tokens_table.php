<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('refresh_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('user_id')
                  ->references('user_id')->on('users')
                  ->onUpdate('cascade')
                  ->onDelete('cascade');
            $table->string('token_hash', 64)->unique(); // SHA-256 hex
            $table->string('device_id')->nullable();
            $table->text('user_agent')->nullable();
            $table->string('ip', 45)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refresh_tokens');
    }
};
