<?php

namespace App\Services;

use App\Models\LdapSyncLog;
use Illuminate\Support\Str;

class LdapAuditService
{
    /**
     * @var LdapSyncLog
     */
    protected $currentLog;

    /**
     * Start a new LDAP Sync Audit session.
     *
     * @return LdapSyncLog
     */
    public function startSync(): LdapSyncLog
    {
        $this->currentLog = LdapSyncLog::create([
            'batch_id' => Str::uuid()->toString(),
            'status' => 'running',
            'started_at' => now(),
        ]);

        return $this->currentLog;
    }

    /**
     * Update the progress of the current sync.
     *
     * @param int $processed
     * @param int $added
     * @param int $updated
     * @param int $failed
     * @return void
     */
    public function updateProgress(int $processed, int $added, int $updated, int $failed): void
    {
        if ($this->currentLog) {
            $this->currentLog->update([
                'users_processed' => $processed,
                'users_added' => $added,
                'users_updated' => $updated,
                'users_failed' => $failed,
            ]);
        }
    }

    /**
     * Finalize the sync session.
     *
     * @param string $status 'success', 'partial', or 'failed'
     * @param array $errors Array of error details
     * @return void
     */
    public function finalizeSync(string $status, array $errors = []): void
    {
        if ($this->currentLog) {
            $this->currentLog->update([
                'status' => $status,
                'errors' => empty($errors) ? null : $errors,
                'completed_at' => now(),
                'duration_ms' => now()->diffInMilliseconds($this->currentLog->started_at),
            ]);
        }
    }

    /**
     * Log a fatal error that crashes the sync.
     *
     * @param \Throwable $e
     * @return void
     */
    public function logFatalError(\Throwable $e): void
    {
        if ($this->currentLog) {
            $errors = $this->currentLog->errors ?? [];
            $errors[] = [
                'type' => 'fatal_exception',
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ];

            $this->finalizeSync('failed', $errors);
        }
    }
}
