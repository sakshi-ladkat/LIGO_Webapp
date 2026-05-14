<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use App\Contracts\OtpServiceInterface;

class OtpService implements OtpServiceInterface
{
    private int $ttl = 600; // 10 min validation time

    private int $maxAttempts = 5;

    private int $ipLimit = 3;

    public function send(string $email, string $ip): string
    {
        // Rate limit (resend control)
        $emailRateKey = "otp:rate:email:$email";
        $emailBlockkey = "otp:block:email:$email";
        $ipRateKey = "otp:rate:ip:$ip";

        //Check if email is blocked
        if (Cache::has($emailBlockkey)) {
            throw new \Exception("Too many OTP requests. Try again later.");
        }

        // Email rate limit (1 request / 60 sec)
        if (Cache::has($emailRateKey)) {
            throw new \Exception("Please wait before requesting again");
        }

        // Track email request count (sliding window)
        $emailCountKey = "otp:count:email:$email";
        $emailCount = (int) Cache::get($emailCountKey, 0) + 1;
        Cache::put($emailCountKey, $emailCount, now()->addSeconds(60));

        //If too many requests → block email
        if ($emailCount > 3) {
            Cache::put($emailBlockkey, 1, now()->addMinutes(10)); // block for 10 min
            throw new \Exception("Too many requests. Email temporarily blocked.");
        }

        //IP rate limit (3 requests/min)
        $ipRequest = (int) Cache::get($ipRateKey, 0) + 1;
        Cache::put($ipRateKey, $ipRequest, now()->addSeconds(60));

        // IP rate limit (3 requests / 1 min)
        if ($ipRequest > $this->ipLimit) {
            throw new \Exception("Too many requests from this IP");
        }

        // Generate OTP
        $otp = random_int(100000, 999999);

        // Store hashed OTP
        $data = [
            'hash' => password_hash($otp, PASSWORD_BCRYPT),
            'attempts' => 0,
            'ip' => $ip
        ];

        Cache::put("otp:$email", json_encode($data), now()->addSeconds($this->ttl));

        // Rate limit (60 sec)
        Cache::put($emailRateKey, 1, now()->addSeconds(60));

        return $otp;
    }

    public function verify(string $email, string $otp, string $ip): bool
    {
        $key = "otp:$email";

        //Fetch OTP data
        $data = Cache::get($key);

        // expired or not found
        if (!$data)
            return false;

        $data = json_decode($data, true);

        if ($data['attempts'] >= $this->maxAttempts) {
            Redis::del($key);
            return false;
        }
        //IP binding check
        if (isset($data['ip']) && $data['ip'] !== $ip) {
            return false;
        }

        //Attempt limit check
        if ($data['attempts'] >= $this->maxAttempts) {
            Cache::forget($key);
            return false;
        }

        //Verify OTP
        if (!password_verify($otp, $data['hash'])) {
            $data['attempts']++;

            Cache::put($key, json_encode($data), now()->addSeconds($this->ttl));
            return false;
        }

        // Success → delete OTP
        Cache::forget($key);

        return true;
    }
}