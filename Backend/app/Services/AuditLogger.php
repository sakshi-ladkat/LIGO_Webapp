<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Request;

class AuditLogger
{
    /**
     * Log an action to the system_audit_logs table.
     *
     * @param string $action e.g., 'created', 'updated', 'deleted', 'login'
     * @param string|null $entityType e.g., 'User', 'Role', 'Application'
     * @param string|null $entityId The ID of the affected resource
     * @param array|null $oldValues JSON array of prior state
     * @param array|null $newValues JSON array of new state
     */
    public static function log(string $action, ?string $entityType = null, ?string $entityId = null, ?array $oldValues = null, ?array $newValues = null)
    {
        $actorId = null;
        if (auth()->check()) {
            $actorId = auth()->user()->user_id;
        }

        DB::table('system_audit_logs')->insert([
            'actor_id' => $actorId,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'old_values' => $oldValues ? json_encode($oldValues) : null,
            'new_values' => $newValues ? json_encode($newValues) : null,
            'ip_address' => Request::ip(),
            'user_agent' => substr(Request::userAgent(), 0, 500),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $oldJson = $oldValues ? json_encode($oldValues) : 'null';
        $newJson = $newValues ? json_encode($newValues) : 'null';
        $logMessage = "Action: {$action} | Actor: " . ($actorId ?: 'System') . " | Entity: {$entityType} #{$entityId} | Old: {$oldJson} | New: {$newJson}";
        
        \Illuminate\Support\Facades\Log::channel('audit_daily')->info($logMessage);
    }
}
