@extends('emails.layouts.master')

@section('content')

<div style="background:#f8fafc;border:1px solid #e5e7eb;padding:20px;border-radius:10px;margin-bottom:24px;">
    <strong style="font-size:14px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Application Details</strong>
    <hr style="border:0;border-top:1px solid #e2e8f0;margin:12px 0;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:15px;">
        <tr>
            <td style="padding-bottom:8px;color:#64748b;" width="120">Reference:</td>
            <td style="padding-bottom:8px;font-weight:600;">
                <span style="background:#eef2ff;color:#4f46e5;padding:4px 10px;border-radius:999px;font-size:12px;">#{{ $applicationId }}</span>
            </td>
        </tr>
        <tr>
            <td style="color:#64748b;">Workflow:</td>
            <td style="font-weight:600;">{{ $workflowName }}</td>
        </tr>
    </table>
</div>

<p>Dear {{ $applicantName }},</p>
<p>Your application has been successfully submitted and will be reviewed by the concerned authorities.</p>
<p>You can track your application status at any time by logging back into your dashboard.</p>

<div style="text-align:center;margin-top:32px;">
    <a href="{{ config('app.frontend_url') }}/#/dashboard" style="display:inline-block;background:#6366f1;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 2px 4px rgba(99,102,241,0.2);">
        View Dashboard
    </a>
</div>

@endsection
