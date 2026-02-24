<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Reset Password</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0;">
    <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); text-align: center;">
        <h2 style="color: #333333; margin-top: 0;">Password Reset Request</h2>
        <p style="color: #555555; line-height: 1.6; font-size: 16px;">
            Hello <strong>{{ $name }}</strong>,<br><br>
            We received a request to reset your password. If you didn't make this request, you can safely ignore this email.
        </p>

        <a href="{{ $link }}" style="display: inline-block; padding: 12px 24px; margin-top: 20px; background-color: #3182ce; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 16px;">
            Reset Password
        </a>

        <p style="color: #999999; font-size: 14px; margin-top: 30px;">
            This link will expire in 60 minutes.<br>
            If the button doesn't work, copy and paste the following link into your browser:<br>
            <a href="{{ $link }}" style="color: #3182ce; word-break: break-all;">{{ $link }}</a>
        </p>
    </div>
</body>
</html>
