<div style='font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px;'>
    <h2 style='color: #d9534f;'>Application Declined</h2>
    <p>Dear {{ $name }},</p>
    <p>Thank you for your interest in OrbitAccess. We have reviewed your application <strong>#{{ $applicationId }}</strong>.</p>
    
    <div style='background: #f9f9f9; padding: 15px; border-left: 4px solid #d9534f;'>
        <strong>Reason / Remarks:</strong><br>
        {{ $reason }}
    </div>
    
    <p>You can log in to your dashboard to view the full details of this decision and see if you are eligible to re-apply in the future.</p>
    
    <p style='margin-top: 25px;'>
        <a href='http://192.168.11.127:5173' style='background: #337ab7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;'>View Dashboard</a>
    </p>
    
    <hr style='border: 0; border-top: 1px solid #eee; margin-top: 30px;'>
    <p style='font-size: 12px; color: #777;'>
        This is an automated notification. Please do not reply directly to this email.<br>
        &copy; 2026 OrbitAccess. All rights reserved.
    </p>
</div>
