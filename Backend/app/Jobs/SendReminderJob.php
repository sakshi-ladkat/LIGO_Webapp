<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use App\Models\ApplicationReminder;
use Illuminate\Support\Facades\Mail;
use App\Mail\PendingReminderMail;
use Carbon\Carbon;

class SendReminderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        $roleDelays = config('reminders.roles', []);

        if (empty($roleDelays)) {
            return;
        }

        // 1. Fetch pending applications, avoiding N+1 queries.
        // Selecting only required columns from apps, joining workflow_steps & roles
        $pendingApps = DB::table('applications as app')
            ->join('workflow_steps as ws', 'app.current_step_id', '=', 'ws.workflow_step_id')
            ->join('roles as r', 'ws.role_id', '=', 'r.id')
            ->whereNotIn('app.status', ['approved', 'completed', 'rejected', 'deactivated'])
            ->whereNotNull('app.current_step_id')
            ->whereNotNull('app.created_at')
            ->select('app.id', 'r.slug as current_role', 'app.created_at as submitted_at')
            ->get();

        $now = now();

        foreach ($pendingApps as $app) {
            $role = $app->current_role;

            if (!array_key_exists($role, $roleDelays)) {
                continue;
            }

            $delayHours = $roleDelays[$role];
            $submittedAt = Carbon::parse($app->submitted_at);
            
            // 2. Calculate deadline
            $deadline = $submittedAt->copy()->addHours($delayHours);

            if ($now->greaterThanOrEqualTo($deadline)) {
                
                // 3. Check application_reminders to prevent duplicates
                $lastReminder = ApplicationReminder::where('application_id', $app->id)
                    ->where('role', $role)
                    ->orderBy('sent_at', 'desc')
                    ->first();

                $shouldSend = false;

                if (!$lastReminder) {
                    $shouldSend = true;
                } else {
                    $lastSentAt = Carbon::parse($lastReminder->sent_at);
                    if ($now->diffInHours($lastSentAt) >= $delayHours) {
                        $shouldSend = true;
                    }
                }

                if ($shouldSend) {
                    // 4. Record the reminder
                    ApplicationReminder::create([
                        'application_id' => $app->id,
                        'role'           => $role,
                        'sent_at'        => now(),
                    ]);

                    // 5. Send email
                    Mail::to('system.alerts@example.com')->send(new PendingReminderMail($app->id, $role));
                }
            }
        }
    }
}
