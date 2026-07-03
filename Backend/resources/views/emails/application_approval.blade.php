@extends('emails.layouts.master')
@section('title', 'Review Required')
@section('content')
    <p>Hello,</p>
    <p>An application from <strong>{{ $applicantName }}</strong> ({{ $applicationId }}) is now pending your review at the
        <strong>{{ $currentStatus }}</strong> stage.</p>
    <p>Please log in to the administrative dashboard to review the details and provide your decision.</p>
@endsection