<?php

namespace App\Contracts;


use App\Services\OtpService;

interface OtpServiceInterface
{
    public function send(string $email, string $ip): string;

    public function verify(string $email, string $otp, string $ip): bool;
}