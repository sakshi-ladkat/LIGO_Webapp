@extends('emails.layouts.master')

@section('content')

<div style="background:#f8fafc;padding:20px;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;text-align:center;">
    <strong style="font-size:14px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Workflow Progress</strong>
    
    <div style="margin:20px 0;">
        <div style="color:#64748b;font-size:15px;display:flex;align-items:center;justify-content:center;">
            <span style="color:#10b981;margin-right:8px;font-size:18px;">✓</span> {{ $currentStepName }}
        </div>
        <div style="color:#cbd5e1;margin:8px 0;font-size:20px;">⬇</div>
        <div style="color:#6366f1;font-weight:700;font-size:16px;">
            {{ $nextStepName }}
        </div>
    </div>
</div>

<p>Dear {{ $applicantName }},</p>
<p>Your application <strong>#{{ $applicationId }}</strong> has successfully completed the <strong>{{ $currentStepName }}</strong> stage and moved forward.</p>
<p>You can view the full timeline and current status on your dashboard.</p>

<div style="text-align:center;margin-top:32px;">
    <a href="{{ config('app.frontend_url') }}/#/dashboard" style="display:inline-block;background:#6366f1;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 2px 4px rgba(99,102,241,0.2);">
        View Dashboard
    </a>
</div>

@endsection
