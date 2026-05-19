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
        // Create block_history table
        Schema::create('block_history', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('user_id')
                ->references('user_id')->on('users')
                ->onDelete('cascade');
            $table->foreignUlid('blocked_by')
                ->references('user_id')->on('users')
                ->onDelete('cascade');
            $table->string('action'); // 'block' or 'unblock'
            $table->text('reason')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('block_history');
    }
};
