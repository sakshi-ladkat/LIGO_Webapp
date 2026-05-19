<!DOCTYPE html>
<html>

<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
        }

        .container {
            max-width: 600px;
            margin: auto;
            border: 1px solid #eee;
            padding: 30px;
            border-radius: 8px;
        }

        .header {
            font-size: 20px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #111;
        }

        .details {
            background: #f9f9f9;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
        }

        .btn-container {
            text-align: center;
            margin: 25px 0;
        }

        .btn {
            display: inline-block;
            background-color: #6366f1;
            color: white !important;
            text-decoration: none;
            padding: 10px 20px;
            border-radius: 4px;
            font-weight: bold;
        }

        .footer {
            font-size: 12px;
            color: #777;
            margin-top: 30px;
            border-top: 1px solid #eee;
            padding-top: 15px;
        }
    </style>
</head>

<body>
    <div class="container">
        <div class="header">OrbitAccess Team Invitation</div>
        <p>Hello,</p>
        <p>You have been invited to join the <strong>OrbitAccess</strong> platform as a member of our research team.</p>

        <div style="background: #f9f9f9; padding: 15px; border-radius: 6px; border: 1px solid #eee; margin: 20px 0; font-size: 14px;">
            <strong>Invitation Details:</strong><br>
            • Created At: {{ $createdAt }}<br>
            • Expires At: {{ $expiresAt }}<br><br>
            <span style="color: #666; font-size: 13px;"><em>Note: For security purposes, this invitation is secure and will automatically expire in 7 days.</em></span>
        </div>

        <p>To get started and log in to your account, click the button below:</p>

        <div class="btn-container">
            <a href="{{ $inviteUrl }}" class="btn">Get Started</a>
        </div>

        <p>If you are unable to click the button above, you can copy and paste the following link directly into your
            browser address bar:</p>
        <p
            style="word-break: break-all; font-size: 13px; background: #f9f9f9; padding: 10px; border-radius: 4px; border: 1px solid #eee;">
            <a href="{{ $inviteUrl }}" style="color: #6366f1; text-decoration: underline;">{{ $inviteUrl }}</a>
        </p>

        <div class="footer">
            If you did not request this invitation, please ignore this email.<br><br>
            Thank you,<br><strong>OrbitAccess Team</strong>
        </div>
    </div>
</body>

</html>