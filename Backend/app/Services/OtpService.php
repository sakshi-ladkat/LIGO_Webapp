<?php

namespace App\Services;

use Illuminate\Support\Facades\Redis;
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
        if (Redis::exists($emailBlockkey)) {
            throw new \Exception("Too many OTP requests. Try again later.");
        }

        // Email rate limit (1 request / 60 sec)
        if (Redis::exists($emailRateKey)) {
            throw new \Exception("Please wait before requesting again");
        }

        // Track email request count (sliding window)
        $emailCountKey = "otp:count:email:$email";
        $emailCount = Redis::incr($emailCountKey);
        if ($emailCount == 1) {
            Redis::expire($emailCountKey, 60); // 1 min window
        }

        //If too many requests → block email
        if ($emailCount > 3) {
            Redis::setex($emailBlockkey, 600, 1); // block for 10 min
            throw new \Exception("Too many requests. Email temporarily blocked.");
        }

        //P rate limit (3 requests/min)
        $ipRequest = Redis::incr($ipRateKey);


        if ($ipRequest == 1) {
            Redis::expire($ipRateKey, 60); // 1 min window 
        }
        // IP rate limit (3 requests / 1 min)
        if ($ipRequest > $this->ipLimit) {
            throw new \Exception("Too many requests from this IP");
        }

        // Generate OTP
        $otp = rand(100000, 999999);

        // Store hashed OTP
        $data = [
            'hash' => password_hash($otp, PASSWORD_BCRYPT),
            'attempts' => 0,
            'ip' => $ip
        ];

        Redis::setex("otp:$email", $this->ttl, json_encode($data));

        // Rate limit (60 sec)
        Redis::setex($emailRateKey, 60, 1);

        return $otp;
    }

    public function verify(string $email, string $otp, string $ip): bool
    {
        $key = "otp:$email";

        //Fetch OTP data
        $data = Redis::get($key);

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
            Redis::del($key);
            return false;
        }

        //Verify OTP
        if (!password_verify($otp, $data['hash'])) {
            $data['attempts']++;

            // Keep remaining TTL
            $ttl = Redis::ttl($key);

            if ($ttl > 0) {
                Redis::setex($key, $ttl, json_encode($data));
            }
            else {
                Redis::del($key);
            }
            return false;
        }

        // Success → delete OTP
        Redis::del($key);

        return true;
    }
}