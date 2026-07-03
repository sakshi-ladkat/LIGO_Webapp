<?php

namespace App\Exceptions\Approval;

use App\Exceptions\Base\OrbitBaseException;

class SelfApprovalViolationException extends OrbitBaseException
{
    protected string $severity = 'Critical';
    protected int $httpStatusCode = 403;
    protected string $userMessage = 'You are not authorized to approve your own requests.';

    public function __construct(int $userId, int $applicationId)
    {
        parent::__construct("Self-approval attempt by User ID {$userId} on Application ID {$applicationId}", [
            'user_id' => $userId,
            'application_id' => $applicationId
        ]);
    }
}
