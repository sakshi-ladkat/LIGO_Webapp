<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background:#f4f7f6; padding:30px;">
    <div style="max-width:600px; margin:auto; background:#fff; border-radius:12px; padding:40px; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
        <div style="text-align:center; margin-bottom:30px;">
            <div style="background:#6366f1; color:white; width:48px; height:48px; border-radius:12px; display:inline-flex; align-items:center; justify-content:center; font-size:24px; font-weight:bold;">A</div>
        </div>
        <h2 style="margin-top:0; color:#1e293b; font-size:20px; text-align:center;">New Application Submitted</h2>
        <p>Dear Reviewer,</p>
        <p>A new application has been submitted and is currently waiting for your review in the approval pipeline.</p>
        
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:20px; margin:25px 0;">
            <p style="margin:0 0 10px 0;"><strong>Applicant:</strong> {{ $applicantName }}</p>
            <p style="margin:0 0 10px 0;"><strong>Application ID:</strong> {{ $applicationId }}</p>
            <p style="margin:0;"><strong>Workflow:</strong> {{ $workflowName }}</p>
        </div>
        
        <p>Please log in to the <strong>IUCAA Dashboard</strong> to review the details and provide your recommendation.</p>
        
        <hr style="border:none; border-top:1px solid #eee; margin:30px 0;">
        <p style="font-size:13px; color:#64748b; text-align:center;">This is an automated notification. Please do not reply directly to this email.</p>
    </div>
</body>
</html>
