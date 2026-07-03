@extends('emails.layouts.master')
@section('title', 'Application Approved')
@section('title_color', '#16a34a')
@section('title_border_color', '#bbf7d0')
@section('content')
    <p>Hello <strong>{{ $applicantName }}</strong>,</p>
    <p>Great news! Your application (<strong>#{{ $applicationId }}</strong>) has received final approval.</p>
    <p>You can now log in to your dashboard to view your active services and access your profile.</p>
@endsection