<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use App\Contracts\OtpServiceInterface;

class OtpService implements OtpServiceInterface
{
    private int $ttl = 600; // 10 min validation time

    private int $maxAttempts = 5;

    private int $ipLimit = 3;

    private function cache()
    {
        return Cache::store('database');
    }

    public function send(string $email, string $ip): string
    {
        // Rate limit (resend control)
        $emailRateKey = "otp:rate:email:$email";
        $emailBlockkey = "otp:block:email:$email";
        $ipRateKey = "otp:rate:ip:$ip";

        //Check if email is blocked
        if ($this->cache()->has($emailBlockkey)) {
            throw new \Exception("Too many OTP requests. Try again later.");
        }

        // Email rate limit (1 request / 60 sec)
        if ($this->cache()->has($emailRateKey)) {
            throw new \Exception("Please wait before requesting again");
        }

        // Track email request count (sliding window)
        $emailCountKey = "otp:count:email:$email";
        $emailCount = (int) $this->cache()->get($emailCountKey, 0) + 1;
        $this->cache()->put($emailCountKey, $emailCount, now()->addSeconds(60));

        //If too many requests → block email
        if ($emailCount > 3) {
            $this->cache()->put($emailBlockkey, 1, now()->addMinutes(10)); // block for 10 min
            throw new \Exception("Too many requests. Email temporarily blocked.");
        }

        //IP rate limit (3 requests/min)
        $ipRequest = (int) $this->cache()->get($ipRateKey, 0) + 1;
        $this->cache()->put($ipRateKey, $ipRequest, now()->addSeconds(60));

        // IP rate limit (3 requests / 1 min)
        if ($ipRequest > $this->ipLimit) {
            throw new \Exception("Too many requests from this IP");
        }

        // Generate OTP
        $otp = (string) random_int(100000, 999999);

        // Store hashed OTP
        $data = [
            'hash' => password_hash($otp, PASSWORD_BCRYPT),
            'attempts' => 0,
            'ip' => $ip
        ];

        $this->cache()->put("otp:$email", json_encode($data), now()->addSeconds($this->ttl));

        // Rate limit (60 sec)
        $this->cache()->put($emailRateKey, 1, now()->addSeconds(60));

        return $otp;
    }

    public function verify(string $email, string $otp, string $ip): bool
    {
        $key = "otp:$email";

        //Fetch OTP data
        $data = $this->cache()->get($key);

        // expired or not found
        if (!$data)
            return false;

        $data = json_decode($data, true);

        if ($data['attempts'] >= $this->maxAttempts) {
            $this->cache()->forget($key);
            return false;
        }
        //IP binding check
        if (isset($data['ip']) && $data['ip'] !== $ip) {
            return false;
        }

        //Attempt limit check
        if ($data['attempts'] >= $this->maxAttempts) {
            $this->cache()->forget($key);
            return false;
        }

        //Verify OTP
        if (!password_verify($otp, $data['hash'])) {
            $data['attempts']++;

            $this->cache()->put($key, json_encode($data), now()->addSeconds($this->ttl));
            return false;
        }

        // Success → delete OTP
        $this->cache()->forget($key);

        return true;
    }
}