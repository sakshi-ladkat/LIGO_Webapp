@extends('emails.layouts.master')
@section('title', 'You\'ve Been Invited')
@section('title_color', '#7c3aed')
@section('title_border_color', '#ddd6fe')
@section('content')
    <p>Hello,</p>
    <p>You have been invited to join OrbitAccess as a member of the research team.</p>
    <p>To get started and log in to your account, click the link below:</p>
    <p><a href="{{ $inviteUrl }}">{{ $inviteUrl }}</a></p>
    <p>Note: For security purposes, this invitation is secure and will automatically expire in 7 days.</p>
@endsection