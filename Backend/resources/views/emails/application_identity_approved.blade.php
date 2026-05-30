@extends('emails.layouts.master')

@section('content')

<div style="background:#ecfdf5;border-left:5px solid #10b981;padding:20px;border-radius:8px;margin-bottom:24px;">
    <h3 style="color:#047857;margin-top:0;display:flex;align-items:center;">
        <span style="margin-right:8px;font-size:20px;">✅</span> Identity Verification Approved
    </h3>
    <p style="margin-bottom:0;color:#065f46;">We are pleased to inform you that your identity verification for application <span style="background:#d1fae5;color:#047857;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;">#{{ $applicationId }}</span> has been successfully completed.</p>
</div>

<p>Dear {{ $name }},</p>
<p>Your application has now been moved to the next stage of the review process. You can track the progress in real-time via your dashboard.</p>

<div style="text-align:center;margin-top:32px;">
    <a href="{{ config('app.frontend_url') }}/#/dashboard" style="display:inline-block;background:#10b981;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 2px 4px rgba(16,185,129,0.2);">
        View Dashboard
    </a>
</div>

@endsection
