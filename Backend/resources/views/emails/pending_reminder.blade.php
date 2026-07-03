@extends('emails.layouts.master')
@section('title', 'Reminder: Pending Review')
@section('content')
    <p>Hello,</p>
    <p>This is an automated reminder that application (<strong>#{{ $applicationId }}</strong>) is currently pending your
        review for the <strong>{{ $role }}</strong> role.</p>
    <p>Please log in to the administrative dashboard at your earliest convenience to review the application details and
        provide your decision.</p>
@endsection