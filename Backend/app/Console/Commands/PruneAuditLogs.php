<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * PruneAuditLogs
 * ─────────────────────────────────────────────────────────────────────────────
 * Scheduled command to delete audit log records older than the configured
 * retention period. Runs monthly via the Laravel scheduler.
 *
 * Schedule: monthly (first day of each month at midnight)
 * Config:   AUDIT_LOG_RETENTION_MONTHS (default: 6)
 *
 * Usage:
 *   php artisan audit:prune              # Use configured retention
 *   php artisan audit:prune --months=12  # Override to 12 months
 *   php artisan audit:prune --dry-run    # Preview without deleting
 */
class PruneAuditLogs extends Command
{
    protected $signature = 'audit:prune
                            {--months= : Override retention period in months}
                            {--dry-run : Show count of rows that would be deleted without deleting}';

    protected $description = 'Delete audit log entries older than the configured retention period.';

    public function handle(): int
    {
        $months  = (int) ($this->option('months') ?: env('AUDIT_LOG_RETENTION_MONTHS', 6));
        $dryRun  = $this->option('dry-run');
        $cutoff  = now()->subMonths($months);

        $count = DB::table('audit_logs')
            ->where('created_at', '<', $cutoff)
            ->count();

        if ($dryRun) {
            $this->info("DRY RUN: {$count} audit log rows would be deleted (older than {$months} months, before {$cutoff->toDateString()}).");
            return self::SUCCESS;
        }

        if ($count === 0) {
            $this->info('No audit logs found older than the retention period. Nothing to prune.');
            return self::SUCCESS;
        }

        // Chunked delete to avoid locking large tables
        $deleted = 0;
        do {
            $chunk = DB::table('audit_logs')
                ->where('created_at', '<', $cutoff)
                ->limit(5000)
                ->delete();
            $deleted += $chunk;
        } while ($chunk > 0);

        $message = "Pruned {$deleted} audit log records older than {$months} months (before {$cutoff->toDateString()}).";
        $this->info($message);
        Log::info("[PruneAuditLogs] $message");

        return self::SUCCESS;
    }
}
