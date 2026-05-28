<div style='font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px;'>
    <h2 style='color: #f0ad4e;'>Action Required: Correction Needed</h2>
    <p>Dear {{ $name }},</p>
    <p>Your application <strong>#{{ $applicationId }}</strong> has been reviewed, and some corrections are required before we can proceed.</p>
    
    <div style='background: #fcf8e3; padding: 15px; border-left: 4px solid #f0ad4e; margin: 20px 0;'>
        <strong style='color: #8a6d3b;'>Reviewer Feedback:</strong>
        <ul style='margin-top: 10px;'>
            @if(!empty($reasons))
                <li><strong>Fields:</strong> {{ $reasons }}</li>
            @endif
            <li><strong>Remarks:</strong> {{ $remarks }}</li>
        </ul>
    </div>
    
    <p>Please log in to your dashboard to edit the flagged sections and resubmit your application.</p>
    
    <p style='margin-top: 25px;'>
        <a href='{{ rtrim(config('app.frontend_url', config('app.url')), '/') }}' style='background: #f0ad4e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;'>Update Application</a>
    </p>
    
    <hr style='border: 0; border-top: 1px solid #eee; margin-top: 30px;'>
    <p style='font-size: 12px; color: #777;'>
        This is an automated notification. Please do not reply directly to this email.<br>
        &copy; 2026 OrbitAccess. All rights reserved.
    </p>
</div>
