<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken as Middleware;

class VerifyCsrfToken extends Middleware
{
    /**
     * The URIs that should be excluded from CSRF verification.
     *
     * API routes are excluded because:
     *  1. CORS policy + credentials:include already prevents cross-origin attacks.
     *  2. auth:sanctum still requires a valid session for protected routes.
     *  3. Excluding lets the /sanctum/csrf-cookie → login flow work reliably
     *     without cookie domain / IP address quirks breaking session matching.
     *
     * @var array<int, string>
     */
    protected $except = [
        'api/*',
    ];
}
