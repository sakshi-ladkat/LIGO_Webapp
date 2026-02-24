<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | IMPORTANT: Use 127.0.0.1 consistently for both frontend and backend
    | during local development. Mixing localhost / 127.0.0.1 breaks cookies.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // Must match the exact origin the browser sends.
    // Vite dev server binds to 127.0.0.1:5173 by default.
    'allowed_origins' => [
        'http://127.0.0.1:5173',
        'http://localhost:5173',     // kept as fallback
    ],

    'allowed_origins_patterns' => [],

    // X-XSRF-TOKEN must be listed so browsers forward it in cross-origin requests
    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 3600,

    // Must be true so browser receives Access-Control-Allow-Credentials: true
    'supports_credentials' => true,

];
