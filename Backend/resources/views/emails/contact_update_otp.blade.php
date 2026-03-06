<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
        .container { background-color: #ffffff; margin: 40px auto; padding: 30px; max-width: 600px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
        h1 { color: #333333; font-size: 24px; text-align: center; }
        p { color: #666666; font-size: 16px; line-height: 1.6; }
        .otp { display: block; width: fit-content; margin: 30px auto; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #4f46e5; background: #eef2ff; padding: 15px 30px; border-radius: 6px; border: 1px dashed #4f46e5; }
        .footer { margin-top: 40px; font-size: 14px; color: #999999; text-align: center; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Verify Your Identity</h1>
        <p>You requested to change your contact information. Please use the following 6-digit verification code to proceed.</p>
        
        <span class="otp">{{ $otp }}</span>
        
        <p>If you did not request to change your contact information, please ignore this email or contact support if you have concerns.</p>
        
        <div class="footer">
            &copy; {{ date('Y') }} LIGO-India. All rights reserved.
        </div>
    </div>
</body>
</html>
