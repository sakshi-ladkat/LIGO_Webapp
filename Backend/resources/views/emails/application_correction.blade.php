@extends('emails.layouts.master')

@section('content')

<div style="background:#fffbeb;border-left:5px solid #f59e0b;padding:20px;border-radius:8px;margin-bottom:24px;">
    <h3 style="color:#b45309;margin-top:0;">Correction Required</h3>
    <p style="margin-bottom:12px;">Your application <span style="background:#fef3c7;color:#b45309;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;">#{{ $applicationId }}</span> requires some adjustments before it can proceed.</p>

    @if(!empty($reasons))
    <p style="margin:0;color:#92400e;"><strong>Fields:</strong></p>
    <p style="margin:4px 0 16px;color:#92400e;">{{ $reasons }}</p>
    @endif

    <p style="margin:0;color:#92400e;"><strong>Reviewer Remarks:</strong></p>
    <p style="margin:4px 0 0;color:#92400e;">{{ $remarks }}</p>
</div>

<p>Dear {{ $name }},</p>
<p>Please log in to your dashboard to edit the flagged sections and resubmit your application.</p>

<div style="text-align:center;margin-top:32px;">
    <a href="{{ config('app.frontend_url') }}/#/dashboard" style="display:inline-block;background:#f59e0b;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 2px 4px rgba(245,158,11,0.2);">
        Update Application
    </a>
</div>

@endsection
