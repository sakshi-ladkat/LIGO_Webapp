@extends('emails.layouts.master')
@section('title', 'Action Required: SSH Key')
@section('title_color', '#ea580c')
@section('title_border_color', '#fed7aa')
@section('content')
    <p>Hello <strong>{{ $applicantName }}</strong>,</p>

    <p>Great news! Your application (<strong>#{{ $applicationId }}</strong>) has received final approval.</p>

    <p>Because you have requested computing services, there is one final step required to activate your account. You must upload your SSH Public Key so that we can provision your system access.</p>

    <p>Please log in to your dashboard and navigate to the <strong>SSH Setup</strong> tab to upload your public key. Your account will be activated immediately upon upload.</p>

    <p>If you need assistance generating an SSH key, please consult our documentation or reach out to support.</p>

    <p><a href="{{ env('FRONTEND_URL', 'http://localhost:5173') }}/#/dashboard"
            style="background-color: #4f46e5; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; display: inline-block;">Go
            to Dashboard</a></p>
@endsection