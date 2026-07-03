@extends('emails.layouts.master')
@section('title', 'Verification Code')
@section('content')
    <p>Hello,</p>
    <p>Use the code below to continue with your secure login.</p>
    <h2 style="color: #0284c7; letter-spacing: 5px;">{{ $otpCode }}</h2>
    <p>Valid for 10 minutes. Do not share this code with anyone.</p>
@endsection