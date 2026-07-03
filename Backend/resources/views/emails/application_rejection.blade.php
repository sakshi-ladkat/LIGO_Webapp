@extends('emails.layouts.master')
@section('title', 'Application Declined')
@section('title_color', '#dc2626')
@section('title_border_color', '#fecaca')
@section('content')
    <p>Hello <strong>{{ $name }}</strong>,</p>
    
    <p>We have reviewed your application (<strong>#{{ $applicationId }}</strong>) and unfortunately, it has been declined.</p>
    
    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; border-radius: 6px; padding: 16px; margin: 24px 0;">
        <h4 style="margin: 0 0 8px 0; color: #b91c1c;">Rejection Reason</h4>
        <p style="margin: 0; color: #7f1d1d; font-style: italic;">"{{ $reason }}"</p>
    </div>
    
    <p>If you have any questions regarding this decision, please reach out to the support team.</p>
@endsection
