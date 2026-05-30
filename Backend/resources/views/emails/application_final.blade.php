@extends('emails.layouts.master')

@section('content')

<div style="text-align:center;padding:20px;margin-bottom:24px;">
    <div style="font-size:56px;margin-bottom:16px;">🎉</div>
    <h2 style="color:#10b981;margin:0 0 10px 0;font-size:24px;">Application Approved!</h2>
    <p style="margin:0;color:#065f46;font-size:16px;">
        Your application <span style="background:#d1fae5;color:#047857;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;">#{{ $applicationId }}</span> has been successfully approved.
    </p>
</div>

<p>Dear {{ $applicantName }},</p>
<p>Congratulations! Your application has been fully approved by all reviewers in the pipeline.</p>
<p>Our technical team has been notified to begin account provisioning. You will receive another email once your credentials and system access are ready.</p>

<div style="text-align:center;margin-top:32px;">
    <a href="{{ config('app.frontend_url') }}/#/dashboard" style="display:inline-block;background:#10b981;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 2px 4px rgba(16,185,129,0.2);">
        View Progress
    </a>
</div>

@endsection