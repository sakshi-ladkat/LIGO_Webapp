@extends('emails.layouts.master')

@section('content')

<div style="background:#eef2ff;border-left:5px solid #6366f1;padding:18px;border-radius:8px;margin-bottom:24px;">
    <h3 style="margin-top:0;color:#3730a3;">Review Required</h3>
    Application <strong>#{{ $applicationId }}</strong> is awaiting your review at the <strong>{{ $currentStatus }}</strong> stage.
</div>

<p>Hello,</p>
<p>An application from <strong>{{ $applicantName }}</strong> has progressed to your step in the approval pipeline.</p>

<p>Please log in to the administrative dashboard to review the details and provide your decision.</p>

<div style="text-align:center;margin-top:32px;">
    <a href="{{ config('app.frontend_url') }}/#/dashboard" style="display:inline-block;background:#6366f1;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 2px 4px rgba(99,102,241,0.2);">
        Review Application
    </a>
</div>

@endsection