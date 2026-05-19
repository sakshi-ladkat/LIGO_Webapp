<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class WorkflowAssignmentService
{
    /**
     * Assign an application to an LI Coordinator based on institute mapping.
     */
    public function assignToLiCoordinator($applicationId, $triggeringUserId = null, $workflowStepId = null)
    {
        $application = DB::table('applications')->where('id', $applicationId)->first();
        if (!$application) return null;

        // 1. Get assigned system's institute_id
        $systemId = $application->assigned_system_id;
        
        // If system not assigned directly, try via subsystem
        if (!$systemId && $application->assigned_subsystem_id) {
            $systemId = DB::table('subsystems')
                ->where('id', $application->assigned_subsystem_id)
                ->value('system_id');
        }

        $instituteId = null;
        if ($systemId) {
            $instituteId = DB::table('systems')
                ->where('id', $systemId)
                ->value('institute_id');
        }

        $assignedUserId = null;
        $reason = "";

        // 2. Primary Rule: Find LI Coordinator for the System's institute
        if ($instituteId) {
            $assignedUserId = DB::table('user_roles as ur')
                ->join('roles as r', 'ur.role_id', '=', 'r.id')
                ->join('user_affilation as ua', 'ur.user_id', '=', 'ua.user_id')
                ->where('r.slug', 'li_coordinator')
                ->where('ur.is_active', true)
                ->where('ua.institute_id', $instituteId)
                ->where('ua.is_active', true)
                ->value('ur.user_id');

            if ($assignedUserId) {
                $reason = "Assigned based on System Institute mapping (Institute ID: $instituteId).";
            }
        }

        // 3. Fallback Rule: Assign to Default LI Coordinator (IUCAA)
        if (!$assignedUserId) {
            $assignedUserId = DB::table('user_roles as ur')
                ->join('roles as r', 'ur.role_id', '=', 'r.id')
                ->where('r.slug', 'li_coordinator')
                ->where('ur.is_active', true)
                ->where('ur.is_default', true)
                ->value('ur.user_id');

            if ($assignedUserId) {
                $reason = "Assigned to Default LI Coordinator (Global Fallback).";
            }
        }

        if ($assignedUserId) {
            // Log the assignment decision
            DB::table('application_logs')->insert([
                'application_id' => $applicationId,
                'workflow_step_id' => $workflowStepId,
                'action_by' => $triggeringUserId, // Pass the user who triggered the decision
                'action' => 'assigned_li_coordinator',
                'remarks' => $reason,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            Log::info("LI Coordinator Assignment: Application $applicationId -> User $assignedUserId ($reason)");
        } else {
            Log::warning("LI Coordinator Assignment FAILED for Application $applicationId: No coordinator found.");
        }

        return $assignedUserId;
    }
}
