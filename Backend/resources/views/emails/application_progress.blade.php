<div style='font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px;'>
    <h2 style='color: #6366f1;'>Application Status Update</h2>
    <p>Dear {{ $applicantName }},</p>
    <p>Your application <strong>#{{ $applicationId }}</strong> has completed the <strong>{{ $currentStepName }}</strong> stage and has now moved to <strong>{{ $nextStepName }}</strong>.</p>
    
    <p>You can view the full timeline and current status on your dashboard.</p>
    
    <p style='margin-top: 25px;'>
        <a href='http://192.168.11.127:5173' style='background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;'>View Dashboard</a>
    </p>
    
    <hr style='border: 0; border-top: 1px solid #eee; margin-top: 30px;'>
    <p style='font-size: 12px; color: #777;'>
        This is an automated notification from OrbitAccess Research Management System.<br>
        &copy; 2026 OrbitAccess. All rights reserved.
    </p>
</div>
