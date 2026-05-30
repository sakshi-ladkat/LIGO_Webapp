@extends('emails.layouts.master')

@section('content')

<div style="background:#eef2ff;padding:24px;border-radius:10px;border:1px solid #c7d2fe;margin-bottom:24px;">
    <h3 style="margin-top:0;color:#3730a3;">You've Been Invited</h3>
    <p style="margin-bottom:16px;">Join OrbitAccess as a member of the research team.</p>

    <div style="background:#ffffff;padding:12px;border-radius:6px;font-size:14px;color:#475569;">
        <p style="margin:0 0 8px;"><strong>Created:</strong> {{ $createdAt }}</p>
        <p style="margin:0;"><strong>Expires:</strong> {{ $expiresAt }}</p>
    </div>
    
    <p style="font-size:12px;color:#64748b;margin-top:16px;font-style:italic;">Note: For security purposes, this invitation is secure and will automatically expire in 7 days.</p>
</div>

<p>Hello,</p>
<p>To get started and log in to your account, click the button below:</p>

<div style="text-align:center;margin:32px 0;">
    <a href="{{ $inviteUrl }}" style="display:inline-block;background:#6366f1;color:white;padding:14px 30px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;box-shadow:0 2px 4px rgba(99,102,241,0.2);">
        Accept Invitation
    </a>
</div>

<p>If you are unable to click the button above, you can copy and paste the following link directly into your browser address bar:</p>
<div style="word-break:break-all;font-size:13px;background:#f8fafc;padding:12px;border-radius:6px;border:1px solid #e2e8f0;margin-top:12px;">
    <a href="{{ $inviteUrl }}" style="color:#6366f1;text-decoration:underline;">{{ $inviteUrl }}</a>
</div>

@endsection