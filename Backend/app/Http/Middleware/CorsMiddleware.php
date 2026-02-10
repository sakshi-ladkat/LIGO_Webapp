<?php
// app/Http/Middleware/CorsMiddleware.php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class CorsMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next)
    {
        // Get the origin from the request
        $origin = $request->header('origin');

        // List of allowed origins
        $allowedOrigins = [
            'http://127.0.0.1:5500',      // VS Code Live Server
            'http://localhost:3000',       // React dev server
            'http://localhost:8080',       // Vue/other dev servers
            'http://127.0.0.1:8000',      // Laravel dev
            'https://yourdomain.com',      // Production domain
            'https://www.yourdomain.com',  // Production domain with www
        ];

        // Check if origin is allowed
        $isOriginAllowed = in_array($origin, $allowedOrigins);

        // Handle preflight requests
        if ($request->isMethod('OPTIONS')) {
            return response('', 200)
                ->header('Access-Control-Allow-Origin', $isOriginAllowed ? $origin : 'http://127.0.0.1:5500')
                ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
                ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept')
                ->header('Access-Control-Max-Age', '3600')
                ->header('Access-Control-Allow-Credentials', 'true');
        }

        // Handle actual requests
        $response = $next($request);

        $response->header('Access-Control-Allow-Origin', $isOriginAllowed ? $origin : 'http://127.0.0.1:5500')
                 ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
                 ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept')
                 ->header('Access-Control-Allow-Credentials', 'true');

        return $response;
    }
}