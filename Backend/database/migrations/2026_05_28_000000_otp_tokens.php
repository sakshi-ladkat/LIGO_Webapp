
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('otp_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('email');
            $table->text('otp_hash');
            $table->string('ip');
            $table->integer('attempts')->default(0);
            $table->boolean('is_blocked')->default(false);
            $table->dateTime('expires_at');
            $table->timestamps();
            $table->index('email');
            $table->index('expires_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('otp_tokens');
    }
};
