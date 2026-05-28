<div style='font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px;'>
    <h2 style='color: #6366f1;'>Application Review Required</h2>
    <p>Hello,</p>
    <p>An application from <strong>{{ $applicantName }}</strong> (#{{ $applicationId }}) is now pending your review at the <strong>{{ $currentStatus }}</strong> stage.</p>
    
    <p>Please log in to the administrative dashboard to review the details and provide your decision.</p>
    
    <p style='margin-top: 25px;'>
        <a href='{{ rtrim(config('app.frontend_url', config('app.url')), '/') }}/admin/workflows' style='background: #6366f1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold;'>Review Application</a>
    </p>
    
    <hr style='border: 0; border-top: 1px solid #eee; margin-top: 30px;'>
    <p style='font-size: 12px; color: #777;'>
        This is an automated notification from OrbitAccess Research Management System.<br>
        &copy; 2026 OrbitAccess. All ownership rights reserved.
    </p>
</div>