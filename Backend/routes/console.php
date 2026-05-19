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
