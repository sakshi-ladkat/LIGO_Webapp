<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    if (request()->wantsJson() || request()->is('api*')) {
        return response()->json(['message' => 'Welcome to the backend API']);
    }
    $frontendUrl = env('FRONTEND_URL', 'http://192.168.11.127:5173');
    return redirect()->away($frontendUrl);
});
