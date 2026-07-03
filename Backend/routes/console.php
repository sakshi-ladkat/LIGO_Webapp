<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

use Illuminate\Support\Facades\Schedule;
use App\Jobs\SendReminderJob;

Schedule::job(new SendReminderJob)->hourly();
Schedule::command('app:process-ldap-provisioning')->daily();
Schedule::command('app:decline-inactive-corrections')->hourly();
Schedule::command('app:expire-invitations')->hourly();
Schedule::command('accounts:check-expiring')->daily();
// Prune audit logs older than AUDIT_LOG_RETENTION_MONTHS (default 6 months) every month
Schedule::command('audit:prune')->monthly();
