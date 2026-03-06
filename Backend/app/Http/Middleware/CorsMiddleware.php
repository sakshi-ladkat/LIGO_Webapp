<?php
// app/Http/Middleware/CorsMiddleware.php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CorsMiddleware
{
    /**
     * Allowed origins for CORS.
     * Add any new dev/prod origins here.
     */
    protected array $allowedOrigins = [
        /*'http://frontend.local',
        'http://127.0.0.1:5173',      // Vite dev server (main)
        'http://localhost:5173',       // Vite dev server (alternate)
        'http://127.0.0.1:5500',      // VS Code Live Server
        'http://localhost:5500',
        'http://localhost:3000',       // React / other dev servers
        'http://localhost:8080',
        'http://127.0.0.1:8000',      // Laravel self-reference
        'https://yourdomain.com',
        'https://www.yourdomain.com',
        */
        'http://192.168.11.127:5173',
        'http://192.168.11.127:8000',
    ];

    public function handle(Request $request, Closure $next)
    {
        $origin = $request->header('Origin');
        $allowedOrigin = in_array($origin, $this->allowedOrigins)
            ? $origin
            : ($this->allowedOrigins[0]); // safe fallback

        // Handle preflight (OPTIONS) immediately
        if ($request->isMethod('OPTIONS')) {
            return response('', 200)
                ->header('Access-Control-Allow-Origin',      $allowedOrigin)
                ->header('Access-Control-Allow-Methods',     'GET, POST, PUT, PATCH, DELETE, OPTIONS')
                ->header('Access-Control-Allow-Headers',     'Content-Type, Authorization, X-Requested-With, Accept, X-XSRF-TOKEN')
                ->header('Access-Control-Allow-Credentials', 'true')
                ->header('Access-Control-Max-Age',           '3600');
        }

        $response = $next($request);

        $response
            ->header('Access-Control-Allow-Origin',      $allowedOrigin)
            ->header('Access-Control-Allow-Methods',     'GET, POST, PUT, PATCH, DELETE, OPTIONS')
            ->header('Access-Control-Allow-Headers',     'Content-Type, Authorization, X-Requested-With, Accept, X-XSRF-TOKEN')
            ->header('Access-Control-Allow-Credentials', 'true');

        return $response;
    }
}
