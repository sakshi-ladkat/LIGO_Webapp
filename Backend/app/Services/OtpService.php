<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use App\Contracts\OtpServiceInterface;
use Carbon\Carbon;

class OtpService implements OtpServiceInterface
{
    private int $ttl = 600; // 10 min validation time

    private int $maxAttempts = 5;

    private int $ipLimit = 3;

    public function send(string $email, string $ip): string
    {
        // Clean expired OTPs
        DB::table('otp_tokens')->where('expires_at', '<', now())->delete();

        // Check if email is blocked
        $blocked = DB::table('otp_tokens')
            ->where('email', $email)
            ->where('is_blocked', true)
            ->where('expires_at', '>', now())
            ->exists();

        if ($blocked) {
            throw new \Exception("Too many OTP requests. Try again later.");
        }

        // Email rate limit (1 request / 60 sec)
        $recentRequest = DB::table('otp_tokens')
            ->where('email', $email)
            ->where('created_at', '>', now()->subSeconds(60))
            ->first();

        if ($recentRequest) {
            throw new \Exception("Please wait before requesting again");
        }

        // Track email request count (3 requests in 60 sec)
        $emailCount = DB::table('otp_tokens')
            ->where('email', $email)
            ->where('created_at', '>', now()->subSeconds(60))
            ->count();

        if ($emailCount >= 3) {
            // Block email for 10 min
            DB::table('otp_tokens')->insert([
                'email' => $email,
                'otp_hash' => 'BLOCKED',
                'ip' => $ip,
                'attempts' => 0,
                'is_blocked' => true,
                'expires_at' => now()->addSeconds(600),
                'created_at' => now(),
                'updated_at' => now()
            ]);
            throw new \Exception("Too many requests. Email temporarily blocked.");
        }

        // IP rate limit (3 requests / min)
        $ipRequest = DB::table('otp_tokens')
            ->where('ip', $ip)
            ->where('created_at', '>', now()->subSeconds(60))
            ->count();

        if ($ipRequest >= $this->ipLimit) {
            throw new \Exception("Too many requests from this IP");
        }

        // Generate OTP
        $otp = (string) rand(100000, 999999);

        // Store hashed OTP
        DB::table('otp_tokens')->insert([
            'email' => $email,
            'otp_hash' => password_hash($otp, PASSWORD_BCRYPT),
            'ip' => $ip,
            'attempts' => 0,
            'is_blocked' => false,
            'expires_at' => now()->addSeconds($this->ttl),
            'created_at' => now(),
            'updated_at' => now()
        ]);

        return $otp;
    }

    public function verify(string $email, string $otp, string $ip): bool
    {
        // Clean expired OTPs
        DB::table('otp_tokens')->where('expires_at', '<', now())->delete();

        // Fetch OTP data
        $token = DB::table('otp_tokens')
            ->where('email', $email)
            ->where('expires_at', '>', now())
            ->orderByDesc('created_at')
            ->first();

        if (!$token) {
            return false;
        }

        // Check attempt limit
        if ($token->attempts >= $this->maxAttempts) {
            DB::table('otp_tokens')->where('id', $token->id)->delete();
            return false;
        }

        // IP binding check
        if ($token->ip !== $ip) {
            return false;
        }

        // Verify OTP
        if (!password_verify($otp, $token->otp_hash)) {
            DB::table('otp_tokens')
                ->where('id', $token->id)
                ->update(['attempts' => $token->attempts + 1]);
            return false;
        }

        // Success → delete OTP
        DB::table('otp_tokens')->where('id', $token->id)->delete();

        return true;
    }
}