<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    | allowed_origins supports wildcards, e.g. 'http://localhost:*'
    | In production replace with the real frontend domain.
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => [
        // Allow explicit FRONTEND_URL from env (set this in production to your frontend URL)
        env('FRONTEND_URL', 'http://localhost:5173'),
        // Local network dev entry
        'http://192.168.11.127:5173',
        // Add deployed frontend on Railway (explicit entry)
        'https://endearing-fascination-production-cf74.up.railway.app',
        // Vercel frontend deployment
        'https://ligo-webapp.vercel.app',
    ],

    // Allow Vercel preview deployments (e.g. https://ligo-webapp-xxxx.vercel.app)
    'allowed_origins_patterns' => [
        '#^https://([a-z0-9-]+\.)*vercel\.app$#i',
    ],

    'allowed_headers' => [
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Access-Token',
        'X-Requested-With',
        'X-Device-Id',
    ],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,
];
