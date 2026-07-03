<?php

namespace App\Exceptions\Base;

use Exception;
use Illuminate\Support\Facades\Log;

abstract class OrbitBaseException extends Exception
{
    protected string $severity = 'Medium'; // Critical, High, Medium, Low
    protected int $httpStatusCode = 400;
    protected string $userMessage = 'An unexpected error occurred.';
    protected array $context = [];

    public function __construct(string $internalMessage, array $context = [])
    {
        parent::__construct($internalMessage);
        $this->context = $context;
    }

    public function getSeverity(): string
    {
        return $this->severity;
    }

    public function getHttpStatusCode(): int
    {
        return $this->httpStatusCode;
    }

    public function getUserMessage(): string
    {
        return $this->userMessage;
    }

    public function getContext(): array
    {
        return $this->context;
    }

    public function report(): void
    {
        $logMethod = match ($this->severity) {
            'Critical' => 'emergency',
            'High' => 'error',
            'Medium' => 'warning',
            default => 'info',
        };

        Log::$logMethod($this->getMessage(), [
            'exception' => class_basename($this),
            'context' => $this->context,
            'user_message' => $this->userMessage
        ]);
    }

    public function render($request): \Illuminate\Http\JsonResponse
    {
        return response()->json([
            'error' => $this->userMessage,
            'reference_id' => uniqid('err_')
        ], $this->httpStatusCode);
    }
}
