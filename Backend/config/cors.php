<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | When credentials (cookies/session) are sent with fetch({ credentials: 'include' }),
    | Access-Control-Allow-Origin MUST be a specific origin — NOT '*'.
    | supports_credentials must also be true so Laravel sets Allow-Credentials: true.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // Explicit origins required when supports_credentials = true
    'allowed_origins' => [
        'http://localhost:5173',    // Vite dev server
        'http://127.0.0.1:5173',   // Vite (alternate)
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 3600,

    // Must be true so browser receives Access-Control-Allow-Credentials: true
    'supports_credentials' => true,

];
