@extends('emails.layouts.master')
@section('title', 'Application Progress')
@section('content')
    <p>Hello <strong>{{ $applicantName }}</strong>,</p>
    <p>Your application (<strong>#{{ $applicationId }}</strong>) has successfully completed the
        <strong>{{ $currentStepName }}</strong> stage and moved forward.</p>

    <p>You can view the full timeline and current status on your dashboard.</p>

    <p><a href="{{ env('FRONTEND_URL', 'http://localhost:5173') }}/#/dashboard"
            style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; display: inline-block;">Track
            Application</a></p>
@endsection