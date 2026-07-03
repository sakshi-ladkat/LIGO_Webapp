<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use App\Models\User;

class CheckExpiringAccounts extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'accounts:check-expiring';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Check for accounts expiring within 7 days and trigger renewal workflows';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting check for expiring accounts...');

        // Find users whose expired_at is within the next 7 days, and who are currently active
        $expiringUsers = User::whereNotNull('expired_at')
            ->where('expired_at', '<=', now()->addDays(7))
            ->where('expired_at', '>=', now())
            ->where('status', 'active')
            ->get();

        $this->info('Found ' . $expiringUsers->count() . ' accounts expiring within 7 days.');

        $reqRenew = DB::table('requests')->where('name', 'Renew Account')->first();

        if (!$reqRenew) {
            $this->error('Renew Account request type not found. Please seed the database.');
            return;
        }

        foreach ($expiringUsers as $user) {
            // Check if there is already an active Renew Account application
            $activeApp = DB::table('applications')
                ->where('user_id', $user->user_id)
                ->where('request_id', $reqRenew->id)
                ->whereIn('status', ['submitted', 'under_review'])
                ->exists();

            if ($activeApp) {
                $this->line("User {$user->user_id} already has a pending renewal request. Skipping.");
                continue;
            }

            // Generate Renewal Request
            $this->generateRenewalRequest($user, $reqRenew);
        }

        $this->info('Finished checking expiring accounts.');
    }

    private function generateRenewalRequest($user, $reqRenew)
    {
        // 1. Get Category ID
        $affiliation = DB::table('user_affilation')->where('user_id', $user->user_id)->first();
        if (!$affiliation) {
            $this->error("User {$user->user_id} has no affiliation. Cannot map workflow.");
            return;
        }

        // 2. Map Workflow
        $targetWorkflow = DB::table('workflow_category_mappings as wcm')
            ->join('workflows as wf', 'wcm.workflow_id', '=', 'wf.workflow_id')
            ->where('wcm.request_id', $reqRenew->id)
            ->where('wcm.category_id', $affiliation->category_id)
            ->where('wf.is_latest', true)
            ->where('wf.is_active', true)
            ->select('wf.workflow_id')
            ->first();

        if (!$targetWorkflow) {
            $this->error("No Renew Account workflow mapped for user {$user->user_id}'s category.");
            return;
        }

        $workflowId = $targetWorkflow->workflow_id;
        $firstStep = DB::table('workflow_steps')
            ->where('workflow_id', $workflowId)
            ->orderBy('step_no', 'asc')
            ->first();

        // 3. Create Application
        $appId = uniqid('APP-REN-');
        $applicationId = DB::table('applications')->insertGetId([
            'user_id' => $user->user_id,
            'request_id' => $reqRenew->id,
            'application_id' => $appId,
            'workflow_id' => $workflowId,
            'current_step_id' => $firstStep ? $firstStep->workflow_step_id : null,
            'status' => 'under_review',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now()
        ]);

        // 4. Pre-fill approval rows
        $allSteps = DB::table('workflow_steps')
            ->where('workflow_id', $workflowId)
            ->orderBy('step_no', 'asc')
            ->get();

        foreach ($allSteps as $ws) {
            DB::table('application_approvals')->insert([
                'application_id' => $applicationId,
                'workflow_step_id' => $ws->workflow_step_id,
                'status' => 'pending',
                'created_at' => now(),
                'updated_at' => now()
            ]);
        }

        // 5. Optionally, assign current_assignee_id to supervisor immediately
        if ($firstStep && $firstStep->role_id) {
            $supervisorRole = DB::table('roles')->where('slug', 'supervisor')->first();
            if ($supervisorRole && $firstStep->role_id === $supervisorRole->id) {
                $supervisorId = DB::table('user_supervisors')->where('user_id', $user->user_id)->value('supervisor_id');
                if ($supervisorId) {
                    DB::table('applications')->where('id', $applicationId)->update([
                        'current_assignee_id' => $supervisorId
                    ]);
                }
            }
        }

        $this->info("Created Renewal Application {$appId} for user {$user->user_id}.");
    }
}
