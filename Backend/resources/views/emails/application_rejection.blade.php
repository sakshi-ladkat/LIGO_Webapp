<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background:#f4f7f6; padding:30px;">
    <div style="max-width:600px; margin:auto; background:#fff; border-radius:12px; padding:40px; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
        <div style="text-align:center; margin-bottom:30px;">
            <div style="background:#ef4444; color:white; width:48px; height:48px; border-radius:12px; display:inline-flex; align-items:center; justify-content:center; font-size:24px; font-weight:bold;">!</div>
        </div>
        <h2 style="margin-top:0; color:#1e293b; font-size:20px; text-align:center;">Update Regarding Your Application</h2>
        <p>Dear {{ $applicantName }},</p>
        <p>There is an update regarding your application (<strong>{{ $applicationId }}</strong>) that requires your attention.</p>
        
        <div style="background:#fff1f2; border:1px solid #fecaca; border-radius:8px; padding:20px; margin:25px 0;">
            <p style="margin:0 0 10px 0; color:#991b1b;"><strong>Reason:</strong> {{ $reason }}</p>
            <p style="margin:0; color:#991b1b;"><strong>Required Action:</strong> {{ $action }}</p>
        </div>
        
        <p>Please follow the instructions mentioned above to proceed. If resubmission is required, you can log in to your dashboard to make the necessary changes.</p>
        
        <hr style="border:none; border-top:1px solid #eee; margin:30px 0;">
        <p style="font-size:13px; color:#64748b; text-align:center;">IUCAA Workflow Management System</p>
    </div>
</body>
</html>
