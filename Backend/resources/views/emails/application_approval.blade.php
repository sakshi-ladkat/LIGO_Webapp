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
        <div class="header">Approval Required</div>
        <p>Dear Reviewer,</p>
        <p>An application has reached your review stage and requires your approval to proceed.</p>
        
        <div class="details">
            <p><strong>Applicant:</strong> {{ $applicantName }}</p>
            <p><strong>Application ID:</strong> {{ $applicationId }}</p>
            <p><strong>Current Status:</strong> {{ $currentStatus }}</p>
        </div>
        
        <p>Please log in to the <strong>OrbitAccess Dashboard</strong> to process this request.</p>
        
        <div class="footer">
            This is an automated notification from OrbitAccess. Please do not reply directly to this email.
        </div>
    </div>
</body>
</html>