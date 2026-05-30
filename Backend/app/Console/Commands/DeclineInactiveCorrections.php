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

        // Find applications where status is 'id_proof_pending'
        // and the action that put them in this state ('send_back_for_id')
        // occurred more than 72 hours ago.
        $appsToDecline = DB::table('applications as a')
            ->select('a.id', 'a.application_id')
            ->join('application_workflow_logs as awl', function($join) {
                // Get the latest 'send_back_for_id' log for this application
                $join->on('a.id', '=', 'awl.application_id')
                     ->where('awl.action', 'send_back_for_id')
                     ->whereRaw('awl.id = (SELECT MAX(id) FROM application_workflow_logs WHERE application_id = a.id AND action = "send_back_for_id")');
            })
            ->where('a.status', 'id_proof_pending')
            ->where('awl.created_at', '<', $deadline)
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
