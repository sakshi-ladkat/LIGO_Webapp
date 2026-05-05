<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: auto; border: 1px solid #eee; padding: 30px; border-radius: 8px; }
        .header { font-size: 20px; font-weight: bold; margin-bottom: 20px; color: #111; }
        .details { background: #fff1f2; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #fecaca; }
        .footer { font-size: 12px; color: #777; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">Update Regarding Your Application</div>
        <p>Dear {{ $applicantName }},</p>
        <p>We regret to inform you that your application (<strong>{{ $applicationId }}</strong>) has been declined.</p>
        
        <div class="details">
            <p><strong>Reason:</strong> {{ $reason }}</p>
            <p><strong>Required Action:</strong> {{ $action }}</p>
        </div>
        
        <p>You can log in to your dashboard for more details or to make any necessary changes if resubmission is permitted.</p>
        
        <div class="footer">
            This is an automated notification from OrbitAccess. Please do not reply directly to this email.
        </div>
    </div>
</body>
</html>
