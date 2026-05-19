<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ExpireInvitations extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:expire-invitations';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Automatically expire old invitations that have passed their expires_at date';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting automated invitation expiration check...');

        $now = Carbon::now();

        // Scope pending invitations that have passed their expires_at
        $expiredInvitations = DB::table('user_invitations')
            ->where('status', 'pending')
            ->where('expires_at', '<', $now)
            ->get();

        $count = 0;

        foreach ($expiredInvitations as $inv) {
            DB::transaction(function () use ($inv) {
                // Update status
                DB::table('user_invitations')
                    ->where('id', $inv->id)
                    ->update([
                        'status' => 'expired',
                        'updated_at' => Carbon::now()
                    ]);

                // Insert log
                DB::table('invitation_logs')->insert([
                    'invitation_id' => $inv->id,
                    'action' => 'expired',
                    'performed_by' => null,
                    'remarks' => 'Invitation expired automatically due to duration exceeding 7 days.',
                    'created_at' => Carbon::now(),
                    'updated_at' => Carbon::now()
                ]);
            });

            $count++;
        }

        $this->info("Successfully expired {$count} pending invitations.");
    }
}
