<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

class TrackerService
{
    /**
     * Get unified tracker details for an application.
     * 
     * Business Logic:
     * This service retrieves the complete history and current state of a workflow application.
     * It maps all predefined workflow steps to actual approval records and logs.
     * 
     * Performance:
     * Optimized to preload all pivot data (approvals, logs, recommended services) to avoid N+1 queries.
     * 
     * @param int $id The database ID of the application
     * @return JsonResponse
     */
    public function getDetails(int $id): JsonResponse
    {
        $app = DB::table('applications as app')
            ->join('workflows as wf', 'app.workflow_id', '=', 'wf.workflow_id')
            ->join('requests as req', 'app.request_id', '=', 'req.id')
            ->leftJoin('workflow_steps as ws', 'app.current_step_id', '=', 'ws.workflow_step_id')
            ->leftJoin('systems as sys', 'app.assigned_system_id', '=', 'sys.id')
            ->leftJoin('subsystems as subsys', 'app.assigned_subsystem_id', '=', 'subsys.id')
            ->leftJoin('users as ureq', 'app.correction_requested_by', '=', 'ureq.user_id')
            ->leftJoin('user_profiles as upreq', 'ureq.user_id', '=', 'upreq.user_id')
            ->leftJoin('users as uapp', 'app.user_id', '=', 'uapp.user_id')
            ->leftJoin('user_profiles as upapp', 'uapp.user_id', '=', 'upapp.user_id')
            ->leftJoin('users as urej', 'app.rejected_by', '=', 'urej.user_id')
            ->leftJoin('user_profiles as uprej', 'urej.user_id', '=', 'uprej.user_id')
            ->where('app.id', $id)
            ->select([
                'app.id',
                'app.user_id',
                'app.application_id',
                'app.current_step_id',
                'app.status',
                'app.created_at as submitted_at',
                'app.workflow_id',
                'app.ligo_member',
                'app.duration',
                'app.computing_services',
                'app.correction_required',
                'app.correction_requested_at',
                'app.paused_workflow_step',
                'app.id_card_path',
                'app.id_card_reupload_remarks',
                'app.rejection_reason',
                'app.rejected_at',
                DB::raw("COALESCE(CONCAT(upreq.first_name, ' ', upreq.last_name), ureq.email) as correction_requested_by_name"),
                DB::raw("COALESCE(CONCAT(upapp.first_name, ' ', upapp.last_name), uapp.email) as applicant_name"),
                DB::raw("COALESCE(CONCAT(uprej.first_name, ' ', uprej.last_name), urej.email) as rejected_by_name"),
                'wf.workflow_name',
                'req.name as request_name',
                'ws.status_name as current_status',
                'ws.step_no as current_step_no',
                'sys.name as assigned_system_name',
                'subsys.name as assigned_subsystem_name',
            ])
            ->first();

        if (!$app) {
            return response()->json(['error' => 'Application not found'], 404);
        }

        // Calculate computing services flag using new 3NF pivot tables
        $hasComputingInApprovals = DB::table('application_approvals as aa')
            ->join('approval_services as asv', 'aa.id', '=', 'asv.approval_id')
            ->join('services as s', 'asv.service_id', '=', 's.id')
            ->where('aa.application_id', $app->id)
            ->where('s.is_computing', true)
            ->exists();

        $app->computing_services = $app->computing_services || $hasComputingInApprovals;

        // Standardize timestamps
        $app->submitted_at = $app->submitted_at ? Carbon::parse($app->submitted_at)->toIso8601String() : null;
        $app->correction_requested_at = $app->correction_requested_at ? Carbon::parse($app->correction_requested_at)->toIso8601String() : null;
        $app->rejected_at = $app->rejected_at ? Carbon::parse($app->rejected_at)->toIso8601String() : null;

        $sshKey = DB::table('ssh_keys')->where('user_id', $app->user_id)->first();

        $steps = DB::table('workflow_steps as ws')
            ->join('roles as r', 'ws.role_id', '=', 'r.id')
            ->where('ws.workflow_id', $app->workflow_id)
            ->orderBy('ws.step_no')
            ->get([
                'ws.workflow_step_id',
                'ws.step_no',
                'ws.status_name',
                'ws.step_action',
                'r.name as role_name'
            ]);

        $approvals = DB::table('application_approvals as aa')
            ->leftJoin('users as u', 'aa.approved_by', '=', 'u.user_id')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->join('workflow_steps as ws', 'aa.workflow_step_id', '=', 'ws.workflow_step_id')
            ->leftJoin('roles as r', 'ws.role_id', '=', 'r.id')
            ->where('aa.application_id', $id)
            ->whereIn('aa.status', ['approved', 'rejected', 'declined'])
            ->select([
                'aa.id as approval_id',
                'aa.workflow_step_id',
                'aa.status',
                'aa.approved_at',
                'aa.remarks',
                'r.name as role_name',
                'u.email as approver_email',
                DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as approved_by_name")
            ])
            ->get()
            ->keyBy('workflow_step_id');

        $logs = DB::table('application_logs as al')
            ->join('users as u', 'al.action_by', '=', 'u.user_id')
            ->leftJoin('user_profiles as up', 'u.user_id', '=', 'up.user_id')
            ->where('al.application_id', $id)
            ->select([
                'al.workflow_step_id',
                'al.remarks',
                'al.action',
                DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as actor_name")
            ])
            ->orderBy('al.created_at', 'desc')
            ->get()
            ->groupBy('workflow_step_id');

        // Pre-fetch all approved services and subservices to avoid N+1 inside the loop
        $allApprovalIds = $approvals->pluck('approval_id')->toArray();
        $approvalServices = [];
        $approvalSubservices = [];
        
        if (!empty($allApprovalIds)) {
            $approvalServices = DB::table('approval_services as asv')
                ->join('services as s', 'asv.service_id', '=', 's.id')
                ->whereIn('asv.approval_id', $allApprovalIds)
                ->get(['asv.approval_id', 's.name'])
                ->groupBy('approval_id')
                ->map(fn($group) => $group->pluck('name')->toArray())
                ->toArray();

            $approvalSubservices = DB::table('approval_subservices as asv')
                ->join('subservices as s', 'asv.subservice_id', '=', 's.id')
                ->whereIn('asv.approval_id', $allApprovalIds)
                ->get(['asv.approval_id', 's.name'])
                ->groupBy('approval_id')
                ->map(fn($group) => $group->pluck('name')->toArray())
                ->toArray();
        }

        $mappedSteps = $steps->map(function ($step) use ($approvals, $logs, $app, $approvalServices, $approvalSubservices) {
            $stepLogs = $logs->get($step->workflow_step_id);
            $latestLog = $stepLogs ? $stepLogs->first() : null;

            if ($approvals->has($step->workflow_step_id)) {
                $approval = (object) $approvals->get($step->workflow_step_id);
                $step->status = $approval->status;

                if ($step->status === 'approved') {
                    if ($step->step_action === 'approve_identity') {
                        $step->status_name = "Identity Approved by " . ($step->role_name ?? 'Reviewer');
                    } else {
                        $step->status_name = "Approved by " . ($step->role_name ?? 'Reviewer');
                    }
                } elseif ($step->status === 'rejected' || $step->status === 'declined') {
                    $step->status_name = "Declined by " . ($step->role_name ?? 'Reviewer');
                }

                $step->approved_by_name = $approval->approved_by_name;
                $step->approver_email = $approval->approver_email;
                $step->approved_at = $approval->approved_at ? Carbon::parse($approval->approved_at)->toIso8601String() : null;
                $step->comments = $latestLog ? $latestLog->remarks : ($approval->remarks ?? null);
                $step->remarks = $step->comments;

                // Use preloaded pivot data
                $services = $approvalServices[$approval->approval_id] ?? [];
                $subservices = $approvalSubservices[$approval->approval_id] ?? [];
                
                $allServices = array_merge($services, $subservices);
                $step->recommended_services = empty($allServices) ? null : implode(', ', $allServices);
            } else {
                $step->status = 'pending';

                if ($app && in_array($app->status, ['rejected', 'declined', 'final_rejection'])) {
                    if ($app->current_step_id == $step->workflow_step_id) {
                        $step->status = 'declined';
                        $step->status_name = "Declined by " . ($step->role_name ?? 'Reviewer');
                        $step->approved_at = $app->rejected_at ? date('Y-m-d\TH:i:s\Z', strtotime($app->rejected_at)) : null;
                        $step->approved_by_name = $app->rejected_by_name;
                        $step->remarks = $app->rejection_reason;
                    } else {
                        $step->status = 'pending';
                    }
                }

                if ($app && isset($app->status) && $app->status === 'id_card_reupload_required' && isset($app->paused_workflow_step) && $app->paused_workflow_step == $step->workflow_step_id) {
                    $step->status_name = "Awaiting ID Card Re-upload";
                    $step->status = 'correction';
                }

                $step->approved_by_name = $latestLog ? $latestLog->actor_name : null;
                $step->approved_at = null;
                $step->comments = $latestLog ? $latestLog->remarks : null;
                $step->remarks = $step->comments;
                $step->recommended_services = null;
            }
            return $step;
        });

        $history = DB::table('applications as app')
            ->join('workflows as wf', 'app.workflow_id', '=', 'wf.workflow_id')
            ->join('requests as req', 'app.request_id', '=', 'req.id')
            ->leftJoin('users as urej', 'app.rejected_by', '=', 'urej.user_id')
            ->leftJoin('user_profiles as uprej', 'urej.user_id', '=', 'uprej.user_id')
            ->where('app.user_id', $app->user_id)
            ->orderByDesc('app.created_at')
            ->select([
                'app.id',
                'app.application_id',
                'app.status',
                'app.created_at as submitted_at',
                'app.updated_at',
                'app.reapplied_from',
                'app.parent_application_id',
                'app.declined_reason',
                'app.rejection_reason',
                'wf.workflow_name',
                'req.name as request_name',
                DB::raw("COALESCE(CONCAT(uprej.first_name, ' ', uprej.last_name), urej.email) as rejected_by_name"),
            ])
            ->get()
            ->map(function ($hApp) {
                $hApp->submitted_at = $hApp->submitted_at ? Carbon::parse($hApp->submitted_at)->toIso8601String() : null;
                $hApp->updated_at = $hApp->updated_at ? Carbon::parse($hApp->updated_at)->toIso8601String() : null;
                return $hApp;
            });

        return response()->json([
            'application' => $app,
            'steps' => $mappedSteps,
            'ssh_key' => $sshKey,
            'history' => $history,
        ]);
    }
}
