@extends('emails.layouts.master')

@section('content')

<div style="text-align:center;">
    <h2 style="color:#111827;margin-top:0;">Verification Code</h2>
    <p style="color:#475569;margin-bottom:24px;">Use the code below to continue with your secure login.</p>

    <div style="display:inline-block;background:#eef2ff;border:2px dashed #6366f1;padding:18px 40px;border-radius:12px;font-size:36px;font-weight:800;letter-spacing:10px;color:#4f46e5;margin:10px 0 24px;">
        {{ $otpCode }}
    </div>

    <p style="color:#64748b;font-size:14px;margin-bottom:0;">
        Valid for 10 minutes. Do not share this code with anyone.
    </p>
</div>

@endsection