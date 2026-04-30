<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background:#f4f7f6; padding:30px;">
    <div style="max-width:600px; margin:auto; background:#fff; border-radius:12px; padding:40px; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
        <div style="text-align:center; margin-bottom:30px;">
            <div style="background:#10b981; color:white; width:48px; height:48px; border-radius:12px; display:inline-flex; align-items:center; justify-content:center; font-size:24px; font-weight:bold;">✓</div>
        </div>
        <h2 style="margin-top:0; color:#1e293b; font-size:20px; text-align:center;">Application Approval Required</h2>
        <p>Dear Reviewer,</p>
        <p>An application has been recommended for approval by the previous authority and is now pending your review.</p>
        
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:20px; margin:25px 0;">
            <p style="margin:0 0 10px 0;"><strong>Applicant:</strong> {{ $applicantName }}</p>
            <p style="margin:0 0 10px 0;"><strong>Application ID:</strong> {{ $applicationId }}</p>
            <p style="margin:0;"><strong>Current Status:</strong> {{ $currentStatus }}</p>
        </div>
        
        <p>Please log in to the <strong>IUCAA Dashboard</strong> to process this request.</p>
        
        <hr style="border:none; border-top:1px solid #eee; margin:30px 0;">
        <p style="font-size:13px; color:#64748b; text-align:center;">IUCAA Workflow Management System</p>
    </div>
</body>
</html>
