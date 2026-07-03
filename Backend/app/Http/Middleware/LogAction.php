<?php
/**
 * LogAction.php
 * ─────────────────────────────────────────────────────────────────────────────
 * Global HTTP middleware that writes all state-changing requests to the
 * audit_logs table via AuditLogService.
 *
 * Files also written daily to storage/logs/audit-YYYY-MM-DD.log via the
 * audit_daily Monolog channel for direct download by authorized admins.
 */

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Services\AuditLogService;

class LogAction
{
    /**
     * Handle an incoming request.
     * Logs all mutating requests (POST/PUT/PATCH/DELETE) plus sensitive GETs.
     */
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        $loggableMethods   = ['POST', 'PUT', 'PATCH', 'DELETE'];
        $sensitiveGetPaths = ['audit-logs', 'users', 'applications'];

        $shouldLog = in_array($request->method(), $loggableMethods)
            || ($request->method() === 'GET'
                && collect($sensitiveGetPaths)->some(fn($p) => str_contains($request->path(), $p)));

        if ($shouldLog) {
            $userId    = $request->auth_user_id ?? null;
            $url       = $request->fullUrl();
            $method    = $request->method();
            $status    = $response->getStatusCode();
            $timestamp = now()->toDateTimeString();

            // ── 1. Write to MySQL via AuditLogService (non-blocking) ──────────
            AuditLogService::log(
                action:  "$method {$request->path()}",
                context: [
                    'user_id'     => $userId,
                    'entity_type' => 'HttpRequest',
                    'entity_id'   => $request->path(),
                    'payload'     => ['url' => $url, 'status' => $status],
                    'ip_address'  => $request->ip(),
                    'user_agent'  => $request->userAgent(),
                ],
                status:  $status >= 400 ? 'failed' : 'success',
            );

        }

        return $response;
    }
}
