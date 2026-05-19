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
        Schema::create('invitation_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('invitation_id');
            $table->string('action'); // 'sent', 'accepted', 'cancelled', 'resent', 'expired'
            $table->foreignUlid('performed_by')
                  ->nullable()
                  ->references('user_id')->on('users')
                  ->onUpdate('cascade')
                  ->onDelete('set null');
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->foreign('invitation_id')
                  ->references('id')->on('user_invitations')
                  ->onUpdate('cascade')
                  ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invitation_logs');
    }
};
