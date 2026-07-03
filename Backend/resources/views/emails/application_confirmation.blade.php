@extends('emails.layouts.master')
@section('title', 'Application Submitted Successfully')
@section('content')
    <p>Dear <strong>{{ $applicantName }}</strong>,</p>
    <p>Your application (<strong>#{{ $applicationId }}</strong>) has been successfully submitted and will be reviewed by the
        concerned authorities.</p>
    <p>You can track your application status at any time by logging back into your dashboard.</p>
@endsection