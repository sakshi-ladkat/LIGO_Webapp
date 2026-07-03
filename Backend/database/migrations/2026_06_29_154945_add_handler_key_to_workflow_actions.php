<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

/**
 * Adds a `handler_key` column to workflow_actions.
 *
 * The handler_key is a string identifier that binds a workflow action to a
 * named server-side handler function in WorkflowActionHandlerService.
 *
 * Examples:
 *   recommend          → triggers email notification to next reviewer
 *   approve            → marks application step approved + advances pipeline
 *   identity_approve   → triggers ID verification check + advance
 *   approve_current    → approve from current institute LI-Coordinator
 *   approve_transfer   → approve from transfer institute LI-Coordinator
 *   decline            → terminates the pipeline, notifies applicant
 *   send_back_for_id   → pauses pipeline, requests ID proof from applicant
 */
return new class extends Migration {
    public function up(): void
    {
        Schema::table('workflow_actions', function (Blueprint $table) {
            // handler_key maps this action to a PHP method in WorkflowActionHandlerService
            $table->string('handler_key')->nullable()->after('slug')
                ->comment('Maps to a named handler in WorkflowActionHandlerService');

            // requires_input: if true, the UI shows an extra form when reviewer clicks this action
            // e.g. system assignment picker, remarks field, duration picker
            $table->json('requires_input')->nullable()->after('handler_key')
                ->comment('JSON array of input field keys this action requires from the reviewer');
        });

        // Seed handler_key values for existing actions
        $actionHandlers = [
            'recommend' => ['handler' => 'recommend', 'inputs' => ['remarks']],
            'approve' => ['handler' => 'approve', 'inputs' => ['remarks', 'duration']],
            'approve_identity' => ['handler' => 'approve_identity', 'inputs' => ['remarks']],
            'approve_current' => ['handler' => 'approve_current', 'inputs' => ['remarks']],
            'reject' => ['handler' => 'reject', 'inputs' => ['remarks']],
            'send_back_for_id' => ['handler' => 'send_back_for_id', 'inputs' => ['remarks']],
        ];

        foreach ($actionHandlers as $slug => $config) {
            DB::table('workflow_actions')->where('slug', $slug)->update([
                'handler_key' => $config['handler'],
                'requires_input' => json_encode($config['inputs']),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('workflow_actions', function (Blueprint $table) {
            $table->dropColumn(['handler_key', 'requires_input']);
        });
    }
};
