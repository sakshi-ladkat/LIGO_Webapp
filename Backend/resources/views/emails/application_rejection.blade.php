@extends('emails.layouts.master')

@section('content')

<div style="background:#fef2f2;border-left:5px solid #ef4444;padding:20px;border-radius:8px;margin-bottom:24px;">
    <h3 style="color:#b91c1c;margin-top:0;">Application Declined</h3>
    <p style="margin-bottom:12px;color:#991b1b;">Your application <span style="background:#fee2e2;color:#b91c1c;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;">#{{ $applicationId }}</span> has been declined by the review board.</p>

    <p style="margin:0;color:#991b1b;"><strong>Reason / Remarks:</strong></p>
    <p style="margin:4px 0 0;color:#991b1b;">{{ $reason }}</p>
</div>

<p>Dear {{ $name }},</p>
<p>Thank you for your interest in OrbitAccess. Unfortunately, we are unable to approve your request at this time based on the feedback above.</p>
<p>You can log in to your dashboard to view the full details of this decision and see if you are eligible to re-apply in the future.</p>

<div style="text-align:center;margin-top:32px;">
    <a href="{{ config('app.frontend_url') }}/#/dashboard" style="display:inline-block;background:#ef4444;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 2px 4px rgba(239,68,68,0.2);">
        View Dashboard
    </a>
</div>

@endsection
