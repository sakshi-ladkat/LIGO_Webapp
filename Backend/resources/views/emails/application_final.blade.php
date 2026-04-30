<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background:#f4f7f6; padding:30px;">
    <div style="max-width:600px; margin:auto; background:#fff; border-radius:12px; padding:40px; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
        <div style="text-align:center; margin-bottom:30px;">
            <div style="background:#2563eb; color:white; width:64px; height:64px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:32px; font-weight:bold;">★</div>
        </div>
        <h2 style="margin-top:0; color:#1e293b; font-size:24px; text-align:center;">Application Fully Approved!</h2>
        <p>Dear {{ $applicantName }},</p>
        <p>Congratulations! Your application has been fully approved by all authorities. Your account services have been activated.</p>
        
        <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; padding:20px; margin:25px 0; text-align:center;">
            <p style="margin:0; color:#0369a1; font-weight:700;">Application ID: {{ $applicationId }}</p>
            <p style="margin:5px 0 0 0; color:#0369a1; font-size:14px;">Status: Account Activated</p>
        </div>
        
        <p>You can now log in to the <strong>IUCAA Dashboard</strong> to access your approved services and systems.</p>
        
        <p>Thank you for your cooperation during the review process.</p>
        
        <hr style="border:none; border-top:1px solid #eee; margin:30px 0;">
        <p style="text-align:center;">Best Regards,<br><strong>IUCAA Team</strong></p>
    </div>
</body>
</html>
