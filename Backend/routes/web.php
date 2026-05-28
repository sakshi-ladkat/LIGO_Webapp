<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    if (request()->wantsJson() || request()->is('api*')) {
        return response()->json(['message' => 'Welcome to the backend API']);
    }
    $frontendUrl = config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173'));
    return redirect()->away($frontendUrl);
});
