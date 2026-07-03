<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * AuditLogService

 */
class AuditLogService
{
    /**
     * Write a single audit log entry.
     *
     * @param  string       $action        e.g. 'approve', 'reject', 'login', 'create_user'
     * @param  array        $context       Contextual fields (user_id, application_id, etc.)
     * @param  string|null  $status        e.g. 'success', 'failed'
     * @param  string|null  $remarks       Human-readable description
     * @return void
     */
    public static function log(string $action, array $context = [], ?string $status = 'success', ?string $remarks = null): void
    {
        try {
            $entry = self::buildEntry($action, $context, $status, $remarks);
            DB::table('audit_logs')->insert($entry);
            Log::channel('audit_daily')->info(json_encode($entry));
        } catch (\Throwable $e) {
            // Logging must NEVER crash the main request.
            Log::error('[AuditLogService] Failed to write audit log: ' . $e->getMessage(), [
                'action' => $action,
                'context' => $context,
            ]);
        }
    }

    /**
     * Write multiple audit log entries in a single batch INSERT.
     * Use this when a single transaction produces multiple loggable events.
     *
     * @param  array  $entries  Array of entries, each compatible with self::log() params.
     *                          Each entry: ['action', 'context', 'status', 'remarks']
     * @return void
     */
    public static function logBatch(array $entries): void
    {
        if (empty($entries))
            return;

        try {
            $rows = array_map(fn($e) => self::buildEntry(
                $e['action'] ?? 'unknown',
                $e['context'] ?? [],
                $e['status'] ?? 'success',
                $e['remarks'] ?? null,
            ), $entries);

            DB::table('audit_logs')->insert($rows);
            foreach ($rows as $row) {
                Log::channel('audit_daily')->info(json_encode($row));
            }
        } catch (\Throwable $e) {
            Log::error('[AuditLogService] Batch insert failed: ' . $e->getMessage());
        }
    }

    /**
     * Build a single normalized audit log row ready for DB insertion.
     * Private — all writes go through log() or logBatch().
     */
    private static function buildEntry(string $action, array $ctx, ?string $status, ?string $remarks): array
    {
        return [
            'application_id' => $ctx['application_id'] ?? null,
            'request_id' => $ctx['request_id'] ?? null,
            'user_id' => $ctx['user_id'] ?? null,
            'action' => $action,
            'status' => $status,
            'remarks' => $remarks,
            'entity_type' => $ctx['entity_type'] ?? null,
            'entity_id' => $ctx['entity_id'] ?? null,
            'payload' => isset($ctx['payload']) ? json_encode($ctx['payload']) : null,
            'ip_address' => $ctx['ip_address'] ?? request()->ip(),
            'user_agent' => $ctx['user_agent'] ?? request()->userAgent(),
            'created_at' => now(),
        ];
    }
}
