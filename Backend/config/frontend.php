<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Frontend Application URL
    |--------------------------------------------------------------------------
    |
    | This URL is used by the backend to generate links to the frontend
    | application, such as email verification links, password reset links,
    | and redirects after authentication.
    |
    */
    'url' => env('FRONTEND_URL', 'http://localhost:8080'),

    /*
    |--------------------------------------------------------------------------
    | Frontend Routes
    |--------------------------------------------------------------------------
    |
    | Define common frontend routes here for easy access throughout the app.
    | These routes use hash-based SPA routing (index.html#/route).
    |
    */
    'routes' => [
        'registration' => '/index.html#/multi-step-register',
        'login' => '/index.html#/login',
        'password_reset' => '/index.html#/reset-password',
        'home' => '/index.html',
    ],
];
