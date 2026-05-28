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
     * Execute the console command to provision LDAP accounts.
     * 
     * Business Logic:
     * This command runs periodically to sweep applications in 'provisioning_pending' state.
     * For each pending application:
     * 1. Generates a unique LDAP username based on their profile.
     * 2. Activates the user account locally.
     * 3. Collects all services/subservices approved during the workflow via pivot tables.
     * 4. Provisions the account in the external LDAP directory.
     * 5. Marks application as 'approved' and emails the user.
     * 
     * Performance:
     * Loops through pending applications and handles transactions individually to ensure
     * that one failing LDAP provision doesn't block or rollback the entire queue.
     * 
     * @param LdapService $ldapService Service to interface with OpenLDAP/AD
     * @param UsernameService $usernameService Service to generate collision-free usernames
     * @return int Exit code
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
                $allSvcIds = DB::table('approval_services')
                    ->join('application_approvals', 'approval_services.approval_id', '=', 'application_approvals.id')
                    ->where('application_approvals.application_id', $app->id)
                    ->pluck('approval_services.service_id')
                    ->toArray();

                $allSubSvcIds = DB::table('approval_subservices')
                    ->join('application_approvals', 'approval_subservices.approval_id', '=', 'application_approvals.id')
                    ->where('application_approvals.application_id', $app->id)
                    ->pluck('approval_subservices.subservice_id')
                    ->toArray();

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
