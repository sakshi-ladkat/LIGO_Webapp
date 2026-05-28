<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\Role;
use App\Models\Category;

class WorkflowSeeder extends Seeder
{
    public function run(): void
    {
        // ─── 1. Resolve core roles natively ─────────────────────────────────────
        $roles = Role::pluck('id', 'slug');

        // ─── 2. Ensure request types exist ──────────────────────────────────────
        $reqAccountActivation = DB::table('requests')->where('name', 'Account Activation')->first();
        if (!$reqAccountActivation) {
            $reqId = DB::table('requests')->insertGetId([
                'name'       => 'Account Activation',
                'type'       => 'service_permission',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            $reqAccountActivation = DB::table('requests')->find($reqId);
        }

        $reqModify = DB::table('requests')->where('name', 'Modify Affiliation')->first();
        if (!$reqModify) {
            $reqModify = DB::table('requests')->find(
                DB::table('requests')->insertGetId([
                    'name'       => 'Modify Affiliation',
                    'type'       => 'modify_affiliation',
                    'created_at' => now(),
                    'updated_at' => now(),
                ])
            );
        }

        // ─── 3. Define all three workflows + their sequential steps ─────────────
        $workflows = [
            'Student Onboarding' => [
                'description' => 'Multi-step approval pipeline for Student registrations.',
                'steps' => [
                    ['role' => 'supervisor',     'action' => 'recommend',         'status' => 'Awaiting Supervisor Recommendation'],
                    ['role' => 'subsystem_lead', 'action' => 'recommend',         'status' => 'Awaiting Subsystem Lead Recommendation'],
                    ['role' => 'system_lead',    'action' => 'recommend',         'status' => 'Awaiting System Lead Recommendation'],
                    ['role' => 'li_coordinator', 'action' => 'approve',           'status' => 'Awaiting LI Coordinator Approval'],
                ],
            ],
            'Faculty Onboarding' => [
                'description' => 'Multi-step approval pipeline for Faculty/Researcher/Staff registrations.',
                'steps' => [
                    ['role' => 'li_coordinator', 'action' => 'approve_identity',  'status' => 'Awaiting Identity Verification'],
                    ['role' => 'subsystem_lead', 'action' => 'recommend',         'status' => 'Awaiting Subsystem Lead Recommendation'],
                    ['role' => 'system_lead',    'action' => 'recommend',         'status' => 'Awaiting System Lead Recommendation'],
                    ['role' => 'li_coordinator', 'action' => 'approve',           'status' => 'Awaiting LI Coordinator Final Approval'],
                ],
            ],
            'Modify Affiliation' => [
                'description' => 'Dual LI Coordinator approval pipeline for affiliation changes.',
                'steps' => [
                    ['role' => 'li_coordinator', 'action' => 'approve_current',   'status' => 'Awaiting Current Institute LI Coordinator Approval'],
                    ['role' => 'li_coordinator', 'action' => 'approve_transfer',  'status' => 'Awaiting New Institute LI Coordinator Approval'],
                ],
            ],
        ];

        // ─── 4. Insert workflows + steps into DB ─────────────────────────────────
        foreach ($workflows as $wfName => $spec) {
            $existing = DB::table('workflows')->where('workflow_name', $wfName)->first();
            if (!$existing) {
                $workflowId = DB::table('workflows')->insertGetId([
                    'workflow_name'        => $wfName,
                    'workflow_description' => $spec['description'],
                    'is_active'            => true,
                    'created_at'           => now(),
                    'updated_at'           => now(),
                ]);
            } else {
                $workflowId = $existing->workflow_id;
                DB::table('workflow_steps')->where('workflow_id', $workflowId)->delete();
            }

            foreach ($spec['steps'] as $stepNo => $step) {
                $roleId = $roles[$step['role']] ?? null;
                if (!$roleId) continue;

                $actionId = DB::table('workflow_actions')->where('slug', $step['action'])->value('id');
                if (!$actionId) {
                    $actionId = DB::table('workflow_actions')->insertGetId([
                        'name' => ucwords(str_replace('_', ' ', $step['action'])),
                        'slug' => $step['action'],
                        'created_at' => now(),
                        'updated_at' => now()
                    ]);
                }

                $statusSlug = \Illuminate\Support\Str::slug($step['status'], '_');
                $statusId = DB::table('workflow_statuses')->where('slug', $statusSlug)->value('id');
                if (!$statusId) {
                    $statusId = DB::table('workflow_statuses')->insertGetId([
                        'name' => $step['status'],
                        'slug' => $statusSlug,
                        'created_at' => now(),
                        'updated_at' => now()
                    ]);
                }

                $strategyId = DB::table('assignment_strategies')->where('slug', 'pool')->value('id');

                $isFinal = ($stepNo === count($spec['steps']) - 1);

                DB::table('workflow_steps')->insert([
                    'workflow_id'  => $workflowId,
                    'step_no'      => $stepNo + 1,
                    'role_id'      => $roleId,
                    'action_id'    => $actionId,
                    'status_id'    => $statusId,
                    'strategy_id'  => $strategyId,
                    'is_final_step'=> $isFinal,
                    'is_active'    => true,
                    'created_at'   => now(),
                    'updated_at'   => now(),
                ]);
            }
        }

        // ─── 5. Resolve request & workflow records ────────────────────────────────
        $reqActivation = DB::table('requests')->where('name', 'Account Activation')->first();
        $reqModifyRec  = DB::table('requests')->where('name', 'Modify Affiliation')->first();

        $wfStudent = DB::table('workflows')->where('workflow_name', 'Student Onboarding')->first();
        $wfFaculty = DB::table('workflows')->where('workflow_name', 'Faculty Onboarding')->first();
        $wfModify  = DB::table('workflows')->where('workflow_name', 'Modify Affiliation')->first();

        // Resolve the 4 parent nodes by slug
        $studentParent    = Category::where('slug', 'student')->first();
        $facultyParent    = Category::where('slug', 'faculty')->first();
        $researcherParent = Category::where('slug', 'researcher-scientist')->first();
        $staffParent      = Category::where('slug', 'staff')->first();

        // ── RULE 1: Student subcats + Account Activation → Student Onboarding ──
        if ($studentParent && $reqActivation && $wfStudent) {
            foreach (Category::where('parent_id', $studentParent->id)->get() as $sub) {
                DB::table('workflow_category_mappings')->updateOrInsert(
                    ['request_id' => $reqActivation->id, 'category_id' => $sub->id],
                    ['workflow_id' => $wfStudent->workflow_id, 'created_at' => now(), 'updated_at' => now()]
                );
            }
        }

        // ── RULE 2: Faculty / Researcher / Staff subcats + Account Activation → Faculty Onboarding ──
        $nonStudentParentIds = array_filter([
            $facultyParent?->id,
            $researcherParent?->id,
            $staffParent?->id,
        ]);
        if ($reqActivation && $wfFaculty && count($nonStudentParentIds)) {
            foreach (Category::whereIn('parent_id', $nonStudentParentIds)->get() as $sub) {
                DB::table('workflow_category_mappings')->updateOrInsert(
                    ['request_id' => $reqActivation->id, 'category_id' => $sub->id],
                    ['workflow_id' => $wfFaculty->workflow_id, 'created_at' => now(), 'updated_at' => now()]
                );
            }
        }

        // ── RULE 3: ALL subcats + Modify Affiliation → Modify Affiliation ──
        if ($reqModifyRec && $wfModify) {
            foreach (Category::whereNotNull('parent_id')->get() as $sub) {
                DB::table('workflow_category_mappings')->updateOrInsert(
                    ['request_id' => $reqModifyRec->id, 'category_id' => $sub->id],
                    ['workflow_id' => $wfModify->workflow_id, 'created_at' => now(), 'updated_at' => now()]
                );
            }
        }
    }
}