<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 500px; margin: auto; border: 1px solid #eee; padding: 30px; border-radius: 8px; }
        .header { font-size: 20px; font-weight: bold; margin-bottom: 20px; color: #111; }
        .otp { font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 5px; margin: 20px 0; }
        .footer { font-size: 12px; color: #777; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">Verification Code</div>
        <p>Your one-time password (OTP) for OrbitAccess is:</p>
        <div class="otp">{{ $otpCode }}</div>
        <p>This code is valid for 10 minutes. Do not share it with anyone.</p>
        
        <div class="footer">
            If you did not request this code, please ignore this email.<br><br>
            Thank you,<br><strong>OrbitAccess Team</strong>
        </div>
    </div>
</body>
</html>