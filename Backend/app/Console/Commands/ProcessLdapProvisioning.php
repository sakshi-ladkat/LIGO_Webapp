<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\User;
use App\Services\LdapService;
use App\Services\UsernameService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use App\Mail\ApplicationFinalMail;

class ProcessLdapProvisioning extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:process-ldap-provisioning';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Process pending LDAP account provisioning for approved applications in batches';

    /**
     * Execute the console command.
     */
    public function handle(LdapService $ldapService, UsernameService $usernameService)
    {
        // 1. Fetch applications in 'provisioning_pending' state
        $apps = DB::table('applications')
            ->where('status', 'provisioning_pending')
            ->get();

        $count = $apps->count();
        
        // 2. Logic: If count is 0, no need to run the script
        if ($count === 0) {
            $this->info("No applications awaiting provisioning. Exiting.");
            return 0;
        }

        $this->info("Found {$count} applications awaiting provisioning. Starting batch process...");

        foreach ($apps as $app) {
            $this->info("Processing Application ID: {$app->application_id} (User: {$app->user_id})");
            
            try {
                DB::beginTransaction();

                $user = User::where('user_id', $app->user_id)->first();
                $profile = DB::table('user_profiles')->where('user_id', $app->user_id)->first();

                if (!$user || !$profile) {
                    $this->error("User profile not found for application {$app->application_id}");
                    DB::rollBack();
                    continue;
                }

                // A. Generate Unique LDAP Username
                $firstName = $profile->first_name ?? 'user';
                $lastName = $profile->last_name ?? 'name';
                $username = $usernameService->generateUnique($firstName, $lastName);

                // B. Activate User Account
                $user->update([
                    'status' => 'active',
                    'username' => $username
                ]);

                // C. Collect Recommended Services
                $allApprovals = DB::table('application_approvals')->where('application_id', $app->id)->get();
                $allSvcIds = [];
                $allSubSvcIds = [];
                foreach ($allApprovals as $approval) {
                    $recs = json_decode($approval->recommended_services, true);
                    if (!empty($recs['service_ids'])) $allSvcIds = array_merge($allSvcIds, $recs['service_ids']);
                    if (!empty($recs['subservice_ids'])) $allSubSvcIds = array_merge($allSubSvcIds, $recs['subservice_ids']);
                }

                // D. Run LDAP Creation Script
                $provisioned = $ldapService->provisionUser($user->fresh(), array_unique($allSvcIds), array_unique($allSubSvcIds));

                if ($provisioned) {
                    // E. Update Application to final approved status
                    DB::table('applications')->where('id', $app->id)->update([
                        'status' => 'approved',
                        'updated_at' => now()
                    ]);

                    // F. Dispatch Final Welcome Email
                    $applicantName = $profile->first_name . ' ' . $profile->last_name;
                    Mail::to($user->email)->send(new ApplicationFinalMail($applicantName, $app->application_id));

                    // G. Log successful batch action
                    DB::table('application_logs')->insert([
                        'application_id' => $app->id,
                        'action' => 'batch_provisioning_complete',
                        'remarks' => "LDAP account created and user activated via 24h scheduler.",
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    DB::commit();
                    $this->info("Successfully provisioned: {$username}");
                } else {
                    $this->error("LDAP script failed for {$username}. Keeping in queue.");
                    DB::rollBack();
                }

            } catch (\Exception $e) {
                DB::rollBack();
                $this->error("Exception for {$app->application_id}: " . $e->getMessage());
                Log::error("LDAP Batch Error: " . $e->getMessage());
            }
        }

        $this->info("Batch process complete.");
        return 0;
    }
}
