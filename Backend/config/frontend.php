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
        'registration' => '/frontend/index.html#/multi-step-register',
        'login' => '/frontend/index.html#/login',
        'password_reset' => '/frontend/index.html#/reset-password',
        'home' => '/frontend/index.html',
    ],
];
