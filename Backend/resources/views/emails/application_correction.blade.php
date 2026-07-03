@extends('emails.layouts.master')
@section('title', 'Correction Required')
@section('title_color', '#ea580c')
@section('title_border_color', '#fed7aa')
@section('content')
    <p>Hello <strong>{{ $applicantName }}</strong>,</p>
    <p>During the review of your application (<strong>#{{ $applicationId }}</strong>), a reviewer has requested some
        corrections.</p>

    <div
        style="background-color: #fff7ed; border-left: 4px solid #f97316; border-radius: 6px; padding: 16px; margin: 24px 0;">
        <h4 style="margin: 0 0 8px 0; color: #c2410c;">Reviewer Remarks</h4>
        <p style="margin: 0; color: #9a3412; font-style: italic;">"{{ $remarks }}"</p>
    </div>

    <p>Please log in to your dashboard, navigate to the tracker, and provide the corrected details to continue the workflow.
    </p>

    <p><a href="{{ env('FRONTEND_URL', 'http://localhost:5173') }}/#/dashboard"
            style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; display: inline-block;">Go
            to Dashboard</a></p>
@endsection