<?php
/**
 * LogAction.php - Log each action on the application to a custom log file.
 */

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\File;

class LogAction
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);

        // Only log state-changing actions or key entries
        if (in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'])) {
            $user = $request->auth_user_id ?? 'guest';
            $url = $request->fullUrl();
            $method = $request->method();
            $ip = $request->ip();
            $timestamp = now()->toDateTimeString();
            $status = $response->getStatusCode();
            
            $logEntry = "[$timestamp] USER: $user | METHOD: $method | URL: $url | STATUS: $status | IP: $ip\n";
            
            // Log to standard Laravel log as well
            Log::info("Application Action: $logEntry");
            
            // Create a custom log.text file as requested
            $logPath = storage_path('logs/log.text');
            File::append($logPath, $logEntry);
        }

        return $response;
    }
}
