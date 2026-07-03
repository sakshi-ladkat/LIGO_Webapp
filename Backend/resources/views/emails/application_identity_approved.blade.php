@extends('emails.layouts.master')
@section('title', 'Identity Approved')
@section('title_color', '#16a34a')
@section('title_border_color', '#bbf7d0')
@section('content')
    <p>Hello <strong>{{ $applicantName }}</strong>,</p>
    <p>Your identity verification for application (<strong>#{{ $applicationId }}</strong>) has been approved.</p>

    <div
        style="background-color: #f0fdf4; border-left: 4px solid #22c55e; border-radius: 6px; padding: 16px; margin: 24px 0;">
        <h4 style="margin: 0 0 8px 0; color: #166534;">Status Update</h4>
        <p style="margin: 0; color: #15803d;">Your application is now moving forward to the technical review stages.</p>
    </div>

    <p><a href="{{ env('FRONTEND_URL', 'http://localhost:5173') }}/#/dashboard"
            style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; display: inline-block;">View
            Dashboard</a></p>
@endsection