<?php

$baseUrl = 'http://192.168.11.127:8000/api';

// 1. Send OTP
$ch = curl_init("$baseUrl/auth/otp/send");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['email' => 'testreg3@example.com']));
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'Accept: application/json']);
$resp1 = curl_exec($ch);
echo "OTP Send: $resp1\n";

// Get OTP from log
$log = file_get_contents('/home/sakshiladkat/Desktop/MSc_Project/Backend/storage/logs/log.text');
preg_match('/OTP GENERATED: (\d+) \| EMAIL: testreg3@example.com/', $log, $matches);
$otp = $matches[1] ?? '123456';

// 2. Verify OTP
$ch2 = curl_init("$baseUrl/auth/otp/verify");
curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch2, CURLOPT_POST, true);
curl_setopt($ch2, CURLOPT_POSTFIELDS, json_encode(['email' => 'testreg3@example.com', 'otp' => $otp]));
curl_setopt($ch2, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'Accept: application/json']);
$resp2 = curl_exec($ch2);
echo "OTP Verify: $resp2\n";

$data = json_decode($resp2, true);
$token = $data['access_token'] ?? '';

if (!$token) {
    die("No token received.\n");
}

// 3. Register
$ch3 = curl_init("$baseUrl/auth/registration");
$postFields = [
    'graduationYear' => '2024',
    'graduationMonth' => '5',
    'department' => 'CS',
    'institute' => 'other',
    'otherInstitute' => 'Test Inst',
    'designation' => '1',
];

curl_setopt($ch3, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch3, CURLOPT_POST, true);
curl_setopt($ch3, CURLOPT_POSTFIELDS, $postFields);
curl_setopt($ch3, CURLOPT_HTTPHEADER, [
    "Authorization: Bearer $token",
    'Accept: application/json'
]);
$resp3 = curl_exec($ch3);
$status = curl_getinfo($ch3, CURLINFO_HTTP_CODE);
echo "Registration (Status $status): $resp3\n";

