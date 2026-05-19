<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use App\Mail\ApplicationCorrectionReminderMail;
use App\Models\User;

class SendCorrectionReminders extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:send-correction-reminders';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send reminder emails to applicants who have pending corrections';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $intervals = [1, 2, 3]; // 1h, 2h, 3h for demo
        
        foreach ($intervals as $hour) {
            $pendingApps = DB::table('applications as app')
                ->where('app.status', 'correction_required')
                ->where('app.correction_requested_at', '<=', now()->subHours($hour))
                ->whereNotExists(function($query) use ($hour) {
                    $query->select(DB::raw(1))
                        ->from('application_reminders')
                        ->whereColumn('application_id', 'app.id')
                        ->where('role', "correction_reminder_{$hour}h");
                })
                ->get();

            $this->info("Found " . $pendingApps->count() . " applications needing {$hour}h reminder.");

            foreach ($pendingApps as $app) {
                $user = User::where('user_id', $app->user_id)->first();
                $profile = DB::table('user_profiles')->where('user_id', $app->user_id)->first();

                if ($user && $user->email) {
                    $name = $profile ? ($profile->first_name . ' ' . $profile->last_name) : 'Applicant';
                    
                    try {
                        Mail::to($user->email)->queue(new ApplicationCorrectionReminderMail(
                            $name,
                            $app->application_id,
                            $app->rejection_reason ?? 'Please address the requested corrections.'
                        ));
                        
                        // Record reminder sent
                        DB::table('application_reminders')->insert([
                            'application_id' => $app->id,
                            'role' => "correction_reminder_{$hour}h",
                            'sent_at' => now(),
                            'created_at' => now(),
                            'updated_at' => now()
                        ]);

                        $this->info("{$hour}h reminder sent to: {$user->email}");
                    } catch (\Exception $e) {
                        $this->error("Failed to send {$hour}h reminder for {$user->email}: " . $e->getMessage());
                    }
                }
            }
        }

        return 0;
    }
}
