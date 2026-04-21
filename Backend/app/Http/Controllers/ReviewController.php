<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ReviewController extends Controller
{
    /**
     * GET /api/review/applications
     *
     * Returns all applications whose current_step_id's role_id matches
     * one of the authenticated user's active roles.
     *
     * Optional ?role_slug= to narrow results to a single role.
     */
    public function index(Request $request): JsonResponse
    {
        $userId = $request->auth_user_id;

        // Fetch the caller's active role IDs
        $roleIds = DB::table('user_roles')
            ->where('user_id', $userId)
            ->where('is_active', true)
            ->pluck('role_id');

        if ($roleIds->isEmpty()) {
            return response()->json([]);
        }

        // Narrow to a specific role when ?role_slug= is provided
        if ($request->filled('role_slug')) {
            $roleIds = DB::table('roles')
                ->whereIn('id', $roleIds)
                ->where('slug', $request->role_slug)
                ->pluck('id');

            if ($roleIds->isEmpty()) {
                return response()->json([]);
            }
        }

        $apps = DB::table('applications as app')
            ->join('workflow_steps as ws', 'app.current_step_id', '=', 'ws.workflow_step_id')
            ->join('workflows as wf',     'app.workflow_id',     '=', 'wf.workflow_id')
            ->join('requests as req',     'app.request_id',      '=', 'req.id')
            ->join('users as u',          'app.user_id',         '=', 'u.user_id')
            ->leftJoin('user_profiles as up', 'u.user_id',       '=', 'up.user_id')
            ->join('roles as r',          'ws.role_id',          '=', 'r.id')
            ->whereIn('ws.role_id', $roleIds)
            ->whereNotNull('app.current_step_id')
            ->select([
                'app.id',
                'app.application_id',
                DB::raw("COALESCE(CONCAT(up.first_name, ' ', up.last_name), u.email) as applicant_name"),
                'u.email as applicant_email',
                'req.name as request_name',
                'wf.workflow_name',
                'ws.status_name as current_status',
                'ws.step_action',
                'ws.workflow_step_id as step_id',
                'r.slug as role_slug',
                'r.name as role_name',
                'app.created_at as submitted_at',
            ])
            ->orderBy('app.created_at', 'asc')
            ->get();

        return response()->json($apps);
    }

    /**
     * GET /api/review/my-application
     *
     * Returns the authenticated user's most recent application
     * plus all workflow steps for that workflow (for timeline rendering).
     */
    public function myApplication(Request $request): JsonResponse
    {
        $userId = $request->auth_user_id;

        /** @var object|null $app */
        $app = DB::table('applications as app')
            ->join('workflows as wf',  'app.workflow_id', '=', 'wf.workflow_id')
            ->join('requests as req',  'app.request_id',  '=', 'req.id')
            ->leftJoin('workflow_steps as ws', 'app.current_step_id', '=', 'ws.workflow_step_id')
            ->where('app.user_id', $userId)
            ->select([
                'app.id',
                'app.application_id',
                'app.current_step_id',
                'app.created_at as submitted_at',
                'app.workflow_id',
                'wf.workflow_name',
                'req.name as request_name',
                'ws.status_name as current_status',
                'ws.step_no    as current_step_no',
            ])
            ->orderByDesc('app.created_at')
            ->first();

        if (!$app) {
            return response()->json(null);
        }

        /** @var mixed $appWorkflowId */
        $appWorkflowId = $app->workflow_id;

        // All steps for this workflow — lets the frontend draw the full timeline
        $steps = DB::table('workflow_steps')
            ->where('workflow_id', $appWorkflowId)
            ->orderBy('step_no')
            ->get(['workflow_step_id', 'step_no', 'status_name', 'step_action']);

        return response()->json([
            'application' => $app,
            'steps'       => $steps,
        ]);
    }

    /**
     * POST /api/review/applications/{id}/decide
     *
     * Approve or reject an application at its current workflow step.
     * - approve  → advance to next step (or mark complete & activate user)
     * - reject   → terminate workflow, mark user as rejected
     */
    public function decide(Request $request, int $id): JsonResponse
    {
        $request->validate([
            'action'  => 'required|in:approve,reject',
            'remarks' => 'nullable|string|max:1000',
        ]);

        $userId = $request->auth_user_id;
        $action = $request->action;

        // 1. Fetch the application
        /** @var object|null $app */
        $app = DB::table('applications')->where('id', $id)->first();
        if (!$app) {
            return response()->json(['error' => 'Application not found.'], 404);
        }

        /** @var mixed $currentStepId */
        $currentStepId = $app->current_step_id ?? null;
        if (is_null($currentStepId)) {
            return response()->json(['error' => 'This application has already been fully processed.'], 422);
        }

        // 2. Fetch the current workflow step
        /** @var object|null $step */
        $step = DB::table('workflow_steps')
            ->where('workflow_step_id', $currentStepId)
            ->first();

        if (!$step) {
            return response()->json(['error' => 'Workflow step not found.'], 404);
        }

        /** @var mixed $stepRoleId */
        $stepRoleId    = $step->role_id;
        /** @var mixed $stepStepNo */
        $stepStepNo    = $step->step_no;
        /** @var mixed $stepStepId */
        $stepStepId    = $step->workflow_step_id;
        /** @var mixed $appWorkflowId */
        $appWorkflowId = $app->workflow_id;
        /** @var mixed $appUserId */
        $appUserId     = $app->user_id;

        // 3. Verify the caller holds the role required for this step
        $hasRole = DB::table('user_roles')
            ->where('user_id', $userId)
            ->where('role_id', $stepRoleId)
            ->where('is_active', true)
            ->exists();

        if (!$hasRole) {
            return response()->json(['error' => 'You are not authorised to act on this application.'], 403);
        }

        DB::beginTransaction();
        try {
            // 4. Log the action
            DB::table('application_logs')->insert([
                'application_id'   => $id,
                'workflow_step_id' => $stepStepId,
                'action_by'        => $userId,
                'action'           => $action,
                'remarks'          => $request->remarks,
                'created_at'       => now(),
                'updated_at'       => now(),
            ]);

            if ($action === 'approve') {
                // 5a. Find the next sequential step
                /** @var object|null $nextStep */
                $nextStep = DB::table('workflow_steps')
                    ->where('workflow_id', $appWorkflowId)
                    ->where('step_no', $stepStepNo + 1)
                    ->first();

                $nextStepId = $nextStep ? $nextStep->workflow_step_id : null;

                DB::table('applications')->where('id', $id)->update([
                    'current_step_id' => $nextStepId,
                    'updated_at'      => now(),
                ]);

                // Update the approval record for the current step
                DB::table('application_approvals')
                    ->where('application_id', $id)
                    ->where('workflow_step_id', $stepStepId)
                    ->update([
                        'status' => 'approved',
                        'approved_by' => $userId,
                        'approved_at' => now(),
                        'updated_at' => now(),
                    ]);

                if (!$nextStep) {
                    // Workflow complete — activate the applicant's account
                    User::where('user_id', $appUserId)->update(['status' => 'active']);
                    DB::table('applications')->where('id', $id)->update([
                        'status' => 'completed',
                        'updated_at' => now(),
                    ]);
                    $message = 'Application approved. Workflow complete — account activated.';
                } else {
                    /** @var mixed $nextStatusName */
                    $nextStatusName = $nextStep->status_name;
                    $message = "Application approved. Moved to: {$nextStatusName}.";
                }

            } else {
                // 5b. Reject — terminate the workflow
                DB::table('applications')->where('id', $id)->update([
                    'status'          => 'rejected',
                    'is_active'       => false,
                    'current_step_id' => null,
                    'updated_at'      => now(),
                ]);

                // Update the approval record for the current step
                DB::table('application_approvals')
                    ->where('application_id', $id)
                    ->where('workflow_step_id', $stepStepId)
                    ->update([
                        'status' => 'rejected',
                        'approved_by' => $userId,
                        'approved_at' => now(),
                        'updated_at' => now(),
                    ]);

                User::where('user_id', $appUserId)->update(['status' => 'rejected']);
                $message = 'Application rejected.';
            }

            DB::commit();
            return response()->json(['message' => $message]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
