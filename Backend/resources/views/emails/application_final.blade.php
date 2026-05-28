<div style='font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px;'>
    <h2 style='color: #28a745;'>Application Fully Approved!</h2>
    <p>Dear {{ $applicantName }},</p>
    <p>Congratulations! Your application <strong>#{{ $applicationId }}</strong> has been fully approved by all reviewers.</p>
    
    <p>Our technical team has been notified to begin account provisioning. You will receive another email once your credentials and system access are ready.</p>
    
    <p style='margin-top: 25px;'>
        <a href='{{ rtrim(config('app.frontend_url', config('app.url')), '/') }}' style='background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;'>View Progress</a>
    </p>
    
    <hr style='border: 0; border-top: 1px solid #eee; margin-top: 30px;'>
    <p style='font-size: 12px; color: #777;'>
        This is an automated notification from OrbitAccess Research Management System.<br>
        &copy; 2026 OrbitAccess. All rights reserved.
    </p>
</div>