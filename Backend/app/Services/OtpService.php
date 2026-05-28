<?php

namespace App\Services;

use App\Contracts\OtpServiceInterface;
use Illuminate\Support\Facades\Cache;

class OtpService implements OtpServiceInterface
{
    private int $ttl = 600; // 10 min validation time

    private int $maxAttempts = 5;

    private int $ipLimit = 3;

    public function send(string $email, string $ip): string
    {
        $otpKey = "otp:$email";
        $emailRateKey = "otp:rate:email:$email";
        $emailBlockKey = "otp:block:email:$email";
        $emailCountKey = "otp:count:email:$email";
        $ipRateKey = "otp:rate:ip:$ip";

        Cache::forget($otpKey);

        // Check if email is blocked
        if (Cache::has($emailBlockKey)) {
            throw new \Exception("Too many OTP requests. Try again later.");
        }

        // Email rate limit (1 request / 60 sec)
        if (Cache::has($emailRateKey)) {
            throw new \Exception("Please wait before requesting again");
        }

        // Track email request count (3 requests in 60 sec)
        if (!Cache::has($emailCountKey)) {
            Cache::put($emailCountKey, 0, now()->addSeconds(60));
        }

        $emailCount = Cache::increment($emailCountKey);

        if ($emailCount >= 3) {
            Cache::put($emailBlockKey, true, now()->addSeconds($this->ttl));
            throw new \Exception("Too many requests. Email temporarily blocked.");
        }

        // IP rate limit (3 requests / min)
        $ipCountKey = "otp:count:ip:$ip";
        if (!Cache::has($ipCountKey)) {
            Cache::put($ipCountKey, 0, now()->addSeconds(60));
        }

        $ipRequest = Cache::increment($ipCountKey);

        if ($ipRequest >= $this->ipLimit) {
            throw new \Exception("Too many requests from this IP");
        }

        // Generate OTP
        $otp = (string) rand(100000, 999999);

        // Store hashed OTP
        Cache::put($otpKey, [
            'hash' => password_hash($otp, PASSWORD_BCRYPT),
            'attempts' => 0,
            'ip' => $ip,
            'expires_at' => now()->addSeconds($this->ttl)->timestamp,
        ], now()->addSeconds($this->ttl));

        Cache::put($emailRateKey, true, now()->addSeconds(60));

        return $otp;
    }

    public function verify(string $email, string $otp, string $ip): bool
    {
        $otpKey = "otp:$email";
        $token = Cache::get($otpKey);

        if (!is_array($token)) {
            return false;
        }

        if (($token['expires_at'] ?? 0) < now()->timestamp) {
            Cache::forget($otpKey);
            return false;
        }

        // Check attempt limit
        if (($token['attempts'] ?? 0) >= $this->maxAttempts) {
            Cache::forget($otpKey);
            return false;
        }

        // IP binding check
        if (($token['ip'] ?? null) !== $ip) {
            return false;
        }

        // Verify OTP
        if (!password_verify($otp, $token['hash'])) {
            $token['attempts'] = ($token['attempts'] ?? 0) + 1;
            $remaining = max(1, ($token['expires_at'] ?? now()->timestamp) - now()->timestamp);
            Cache::put($otpKey, $token, now()->addSeconds($remaining));
            return false;
        }

        // Success → delete OTP
        Cache::forget($otpKey);

        return true;
    }
}