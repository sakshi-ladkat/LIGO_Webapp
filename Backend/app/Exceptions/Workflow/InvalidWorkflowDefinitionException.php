<?php

namespace App\Exceptions\Workflow;

use App\Exceptions\Base\OrbitBaseException;

class InvalidWorkflowDefinitionException extends OrbitBaseException
{
    protected string $severity = 'High';
    protected int $httpStatusCode = 422;
    protected string $userMessage = 'This workflow configuration is invalid and cannot be executed.';

    public function __construct(int $workflowId, string $details)
    {
        parent::__construct("Invalid workflow configuration for Workflow ID {$workflowId}: {$details}", [
            'workflow_id' => $workflowId,
            'details' => $details
        ]);
    }
}
