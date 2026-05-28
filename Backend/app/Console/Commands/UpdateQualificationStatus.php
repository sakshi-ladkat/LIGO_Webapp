<?php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class UpdateQualificationStatus extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:update-qualification-status';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Update is_active status of user qualifications based on graduation month and year';

    /**
     * Execute the console command to sweep through user qualifications.
     * 
     * Business Logic: 
     * A qualification is considered "active" (is_active = true) if the graduation 
     * date is in the future or the current month. If the graduation date has passed, 
     * it is marked "inactive".
     * This command runs periodically (e.g. daily via scheduler) to automatically expire 
     * old qualifications without user intervention.
     * 
     * Performance: 
     * Uses bulk `update()` queries directly on the database to prevent memory exhaustion 
     * and N+1 query issues.
     *
     * @return void
     */
    public function handle()
    {
        $this->info('Starting qualification status update...');
        
        $now = Carbon::now();
        $currentYear = $now->year;
        $currentMonth = $now->month;

        // Logic: 
        // Active if (Year > CurrentYear) 
        // OR (Year == CurrentYear AND Month >= CurrentMonth)
        
        $updatedCount = DB::table('user_qualification')
            ->where(function($query) use ($currentYear, $currentMonth) {
                // Set to inactive if date passed
                $query->where('graduation_year', '<', $currentYear)
                      ->orWhere(function($q) use ($currentYear, $currentMonth) {
                          $q->where('graduation_year', '=', $currentYear)
                            ->where('graduation_month', '<', $currentMonth);
                      });
            })
            ->where('is_active', true)
            ->update(['is_active' => false, 'updated_at' => now()]);

        // Ensure future ones are active (just in case they were manually set to inactive)
        $reactivatedCount = DB::table('user_qualification')
            ->where(function($query) use ($currentYear, $currentMonth) {
                $query->where('graduation_year', '>', $currentYear)
                      ->orWhere(function($q) use ($currentYear, $currentMonth) {
                          $q->where('graduation_year', '=', $currentYear)
                            ->where('graduation_month', '>=', $currentMonth);
                      });
            })
            ->where('is_active', false)
            ->update(['is_active' => true, 'updated_at' => now()]);

        $this->info("Successfully updated qualifications. Deactivated: {$updatedCount}, Reactivated: {$reactivatedCount}.");
    }
}
