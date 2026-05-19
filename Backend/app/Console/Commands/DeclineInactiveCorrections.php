<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use App\Services\WorkflowLifecycleService;
use Carbon\Carbon;

class DeclineInactiveCorrections extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:decline-inactive-corrections';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Automatically decline applications that failed to provide ID correction within 72 hours.';

    /**
     * Execute the console command.
     */
    public function handle(WorkflowLifecycleService $lifecycle)
    {
        $this->info("Starting auto-decline process for inactive corrections...");

        $deadline = Carbon::now()->subHours(72);

        $appsToDecline = DB::table('applications')
            ->where('status', 'id_card_reupload_required')
            ->where('id_card_review_requested_at', '<', $deadline)
            ->get();

        if ($appsToDecline->isEmpty()) {
            $this->info("No applications found for auto-decline.");
            return;
        }

        $count = 0;
        foreach ($appsToDecline as $app) {
            $this->info("Auto-declining application #{$app->application_id} (ID: {$app->id}) due to inactivity.");
            
            try {
                $lifecycle->finalReject(
                    $app->id, 
                    "Application automatically declined due to no response for identity proof correction within 72 hours.", 
                    'SYSTEM'
                );
                $count++;
            } catch (\Exception $e) {
                $this->error("Failed to decline application #{$app->application_id}: " . $e->getMessage());
            }
        }

        $this->info("Auto-decline process completed. Total declined: {$count}");
    }
}
