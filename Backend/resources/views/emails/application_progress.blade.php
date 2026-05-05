<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: auto; border: 1px solid #eee; padding: 30px; border-radius: 8px; }
        .header { font-size: 20px; font-weight: bold; margin-bottom: 20px; color: #111; }
        .details { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .footer { font-size: 12px; color: #777; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">Application Progress Update</div>
        <p>Dear {{ $applicantName }},</p>
        <p>Your application has been approved at the current stage and is moving forward in the approval pipeline.</p>
        
        <div class="details">
            <p><strong>Application ID:</strong> {{ $applicationId }}</p>
            <p><strong>Approved at:</strong> {{ $currentStepName }}</p>
            <p><strong>Now with:</strong> {{ $nextStepName }}</p>
        </div>
        
        <p>You can track the progress at any time by logging into your dashboard.</p>
        
        <div class="footer">
            This is an automated notification from OrbitAccess. Please do not reply directly to this email.
        </div>
    </div>
</body>
</html>
