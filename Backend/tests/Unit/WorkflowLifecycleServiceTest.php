<?php

namespace Tests\Unit;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

/**
 * Bug Analysis Summary:
 *
 * BUG-1: finalReject() → NullPointerException when $app is null
 *   Location: WorkflowLifecycleService::finalReject() line 124
 *   Scenario: If $applicationId does not exist, $app is null, but
 *             DB::table('users')->where('user_id', $app->user_id) on line 124
 *             will throw a PHP TypeError before any null-check.
 *
 * BUG-2: moveToNextStep() → json_decode on an array
 *   Location: WorkflowLifecycleService::moveToNextStep() line 258
 *   Scenario: $recommendedServices is passed as an array (checked on line 235),
 *             but line 258 does json_decode($recommendedServices, true) where it
 *             is ALREADY an array. json_decode(array) returns null → $rs is null
 *             → the computing_services check is silently skipped.
 *
 * BUG-3: decide() → $message undefined when action is 'decline'/'final_rejection'
 *   Location: WorkflowController::decide() line 927
 *   Scenario: If the action is 'send_back_for_id', 'final_rejection', or 'decline',
 *             $message is assigned inside a branch. If none match (due to future
 *             validator rule extension), $message is undefined → PHP notice/crash.
 *
 * BUG-4: approveIdCard() → $liCoordinatorRoleId may be null passed to whereIn
 *   Location: WorkflowController::approveIdCard() line 1028
 *   Scenario: If the 'li_coordinator' role hasn't been created yet,
 *             $liCoordinatorRoleId is null. The query compares role_id to null,
 *             which MySQL treats as 'role_id IS NULL' — always false in practice,
 *             but logically incorrect.
 *
 * BUG-5: DuplicateApplicantService::calculateRiskScore() → undefined variable $percent
 *   Location: DuplicateApplicantService::calculateRiskScore() line 167
 *   Scenario: similar_text() writes to $percent by reference, but if either
 *             $p1->normalized_full_name or $p2->normalized_full_name is null,
 *             similar_text() receives null strings and $percent may be 0.0 or
 *             undefined depending on PHP version.
 *
 * BUG-6: WorkflowController::decide() — duplicate $liCoordinatorRoleId lookup
 *   Location: Lines 716 and 873 — fetched twice in same request via separate queries.
 *
 * BUG-7: WorkflowLifecycleService::moveToNextStep() → approval_services INSERT on duplicate
 *   Location: Line 238 — if moveToNextStep() is called twice for the same approval
 *   (e.g. retry due to network timeout), the updateOrInsert re-uses the same
 *   approval_id but the approval_services insert runs again → duplicate pivot rows.
 */
class WorkflowLifecycleServiceTest extends TestCase
{
    use RefreshDatabase;

    // ──────────────────────────────────────────────────────────────────
    // HELPERS
    // ──────────────────────────────────────────────────────────────────

    private function seedRole(string $slug, string $name = null): int
    {
        return DB::table('roles')->insertGetId([
            'name'       => $name ?? ucfirst(str_replace('_', ' ', $slug)),
            'slug'       => $slug,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedUser(string $email = 'test@test.com'): string
    {
        $userId = 'usr_' . uniqid();
        DB::table('users')->insert([
            'user_id'    => $userId,
            'email'      => $email,
            'status'     => 'onboarding',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('user_profiles')->insert([
            'user_id'    => $userId,
            'first_name' => 'Test',
            'last_name'  => 'User',
            'date_of_birth' => '2000-01-01',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        return $userId;
    }

    private function seedWorkflow(): array
    {
        $wfId = DB::table('workflows')->insertGetId([
            'workflow_name' => 'Test Workflow',
            'is_active'     => true,
            'created_at'    => now(),
            'updated_at'    => now(),
        ]);
        $roleId = $this->seedRole('pet_lead');
        $stepId = DB::table('workflow_steps')->insertGetId([
            'workflow_id' => $wfId,
            'role_id'     => $roleId,
            'step_no'     => 1,
            'status_name' => 'Under Review',
            'step_action' => 'approve',
            'is_active'   => true,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);
        return ['workflow_id' => $wfId, 'step_id' => $stepId, 'role_id' => $roleId];
    }

    private function seedRequest(): int
    {
        return DB::table('requests')->insertGetId([
            'name'       => 'Test Request',
            'is_active'  => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedApplication(string $userId, int $workflowId, int $stepId, string $status = 'under_review'): int
    {
        $reqId = $this->seedRequest();
        return DB::table('applications')->insertGetId([
            'application_id'  => 'APP-' . uniqid(),
            'user_id'         => $userId,
            'workflow_id'     => $workflowId,
            'request_id'      => $reqId,
            'current_step_id' => $stepId,
            'status'          => $status,
            'is_active'       => true,
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);
    }

    // ──────────────────────────────────────────────────────────────────
    // BUG-1: finalReject with non-existent application
    // ──────────────────────────────────────────────────────────────────

    /**
     * @test
     * BUG-1: finalReject() must handle a non-existent application ID gracefully
     * instead of crashing with TypeError on $app->user_id when $app is null.
     */
    public function test_final_reject_with_nonexistent_application_returns_false_not_crash(): void
    {
        $service = app(\App\Services\WorkflowLifecycleService::class);

        // This should return false, NOT throw TypeError: Cannot access property on null
        $result = $service->finalReject(99999, 'Test rejection', 'reviewer_id');

        $this->assertFalse($result, 'finalReject should return false for non-existent application, not crash');
    }

    // ──────────────────────────────────────────────────────────────────
    // BUG-2: json_decode on already-decoded array in moveToNextStep
    // ──────────────────────────────────────────────────────────────────

    /**
     * @test
     * BUG-2: moveToNextStep passes $recommendedServices as an array to is_array check
     * (line 235) but then calls json_decode on the same variable (line 258),
     * causing the computing_services check to silently fail.
     */
    public function test_move_to_next_step_correctly_processes_array_services(): void
    {
        $userId = $this->seedUser('applicant@test.com');
        $workflow = $this->seedWorkflow();

        // Seed a service with is_computing = true
        $serviceId = DB::table('services')->insertGetId([
            'name'         => 'Computing Service',
            'code'         => 'CS-01',
            'is_active'    => true,
            'is_computing' => true,
            'created_at'   => now(),
            'updated_at'   => now(),
        ]);

        $appId = $this->seedApplication($userId, $workflow['workflow_id'], $workflow['step_id']);
        $actorId = $this->seedUser('actor@test.com');

        $service = app(\App\Services\WorkflowLifecycleService::class);

        // Pass services as array — this is the real usage pattern from WorkflowController
        $recommendedServices = [
            'service_ids'    => [$serviceId],
            'subservice_ids' => [],
        ];

        $service->moveToNextStep($appId, $actorId, null, 'test', $recommendedServices);

        // BUG: if json_decode(array) silently returned null, computing_services stays false
        $app = DB::table('applications')->where('id', $appId)->first();
        $this->assertTrue((bool) $app->computing_services,
            'BUG-2: computing_services should be true when a computing service is recommended, but json_decode(array) breaks this');
    }

    // ──────────────────────────────────────────────────────────────────
    // BUG-7: Duplicate approval_services rows on retry
    // ──────────────────────────────────────────────────────────────────

    /**
     * @test
     * BUG-7: Calling moveToNextStep twice for the same step (simulating a
     * retry scenario) must not create duplicate approval_services rows.
     */
    public function test_move_to_next_step_does_not_duplicate_approval_services_on_retry(): void
    {
        $userId = $this->seedUser('dup_applicant@test.com');
        $workflow = $this->seedWorkflow();
        $appId    = $this->seedApplication($userId, $workflow['workflow_id'], $workflow['step_id']);
        $actorId  = $this->seedUser('dup_actor@test.com');

        $serviceId = DB::table('services')->insertGetId([
            'name'         => 'Network Service',
            'code'         => 'NS-01',
            'is_active'    => true,
            'is_computing' => false,
            'created_at'   => now(),
            'updated_at'   => now(),
        ]);

        $service = app(\App\Services\WorkflowLifecycleService::class);
        $recommendedServices = ['service_ids' => [$serviceId], 'subservice_ids' => []];

        // First call — normal
        $service->moveToNextStep($appId, $actorId, null, 'first', $recommendedServices);

        // Reset step to simulate retry — real scenario: timeout then retry
        DB::table('applications')->where('id', $appId)->update(['current_step_id' => $workflow['step_id']]);

        // Second call — retry
        $service->moveToNextStep($appId, $actorId, null, 'retry', $recommendedServices);

        $approvalId = DB::table('application_approvals')
            ->where('application_id', $appId)
            ->value('id');

        $count = DB::table('approval_services')
            ->where('approval_id', $approvalId)
            ->count();

        $this->assertEquals(1, $count,
            'BUG-7: approval_services should not have duplicate rows for the same approval on retry');
    }

    // ──────────────────────────────────────────────────────────────────
    // sendBackForIdCard — happy path
    // ──────────────────────────────────────────────────────────────────

    /**
     * @test
     * sendBackForIdCard should update the application status correctly.
     */
    public function test_send_back_for_id_card_updates_status(): void
    {
        $userId = $this->seedUser('back@test.com');
        $workflow = $this->seedWorkflow();
        $appId    = $this->seedApplication($userId, $workflow['workflow_id'], $workflow['step_id']);
        $actorId  = $this->seedUser('actor_back@test.com');

        $service = app(\App\Services\WorkflowLifecycleService::class);
        $service->sendBackForIdCard($appId, 'Invalid ID card', $actorId);

        $app = DB::table('applications')->where('id', $appId)->first();
        $this->assertEquals('id_card_reupload_required', $app->status);
        $this->assertNotNull($app->paused_workflow_step);
    }

    /**
     * @test
     * sendBackForIdCard must throw an exception if the ID card is already approved.
     */
    public function test_send_back_for_id_card_throws_if_already_approved(): void
    {
        $this->expectException(\Exception::class);
        $this->expectExceptionMessageMatches('/already been verified/i');

        $userId = $this->seedUser('approved_id@test.com');
        $workflow = $this->seedWorkflow();
        $appId    = $this->seedApplication($userId, $workflow['workflow_id'], $workflow['step_id']);
        $actorId  = $this->seedUser('approver_id@test.com');

        // Pre-approve the ID card
        DB::table('applications')->where('id', $appId)->update(['id_card_approved_by' => $actorId]);

        $service = app(\App\Services\WorkflowLifecycleService::class);
        $service->sendBackForIdCard($appId, 'Attempt to resend', $actorId);
    }

    // ──────────────────────────────────────────────────────────────────
    // finalReject — happy path and retry count
    // ──────────────────────────────────────────────────────────────────

    /**
     * @test
     * finalReject should set status to 'declined'.
     */
    public function test_final_reject_marks_application_declined(): void
    {
        $userId = $this->seedUser('declined@test.com');
        $workflow = $this->seedWorkflow();
        $appId    = $this->seedApplication($userId, $workflow['workflow_id'], $workflow['step_id']);
        $actorId  = $this->seedUser('decliner@test.com');

        $service = app(\App\Services\WorkflowLifecycleService::class);
        $service->finalReject($appId, 'Duplicate application', $actorId);

        $app  = DB::table('applications')->where('id', $appId)->first();

        $this->assertEquals('declined', $app->status);
        $this->assertEquals(0, $app->is_active);
    }

    // ──────────────────────────────────────────────────────────────────
    // moveToNextStep — final approval
    // ──────────────────────────────────────────────────────────────────

    /**
     * @test
     * When there is no next workflow step, moveToNextStep should return final_approved
     * and set current_step_id to null.
     */
    public function test_move_to_next_step_final_approval_when_no_next_step(): void
    {
        $userId = $this->seedUser('final_approval@test.com');
        $workflow = $this->seedWorkflow();
        $appId    = $this->seedApplication($userId, $workflow['workflow_id'], $workflow['step_id']);
        $actorId  = $this->seedUser('final_actor@test.com');

        // Only one step in this workflow — no next step
        $service = app(\App\Services\WorkflowLifecycleService::class);
        $result  = $service->moveToNextStep($appId, $actorId);

        $this->assertEquals('final_approved', $result['status']);

        $app = DB::table('applications')->where('id', $appId)->first();
        $this->assertNull($app->current_step_id, 'current_step_id should be null after final approval');
    }

    /**
     * @test
     * When there IS a next workflow step, application advances and status is 'under_review'.
     */
    public function test_move_to_next_step_advances_to_next_step(): void
    {
        $userId = $this->seedUser('advance@test.com');
        $workflow = $this->seedWorkflow();
        $appId    = $this->seedApplication($userId, $workflow['workflow_id'], $workflow['step_id']);
        $actorId  = $this->seedUser('advance_actor@test.com');

        // Seed a second step
        $role2Id  = $this->seedRole('system_lead');
        $step2Id  = DB::table('workflow_steps')->insertGetId([
            'workflow_id' => $workflow['workflow_id'],
            'role_id'     => $role2Id,
            'step_no'     => 2,
            'status_name' => 'System Review',
            'step_action' => 'approve',
            'is_active'   => true,
            'created_at'  => now(),
            'updated_at'  => now(),
        ]);

        $service = app(\App\Services\WorkflowLifecycleService::class);
        $result  = $service->moveToNextStep($appId, $actorId);

        $this->assertNotEquals('final_approved', $result['status']);

        $app = DB::table('applications')->where('id', $appId)->first();
        $this->assertEquals($step2Id, $app->current_step_id, 'Application should advance to step 2');
        $this->assertEquals('under_review', $app->status);
    }
}
