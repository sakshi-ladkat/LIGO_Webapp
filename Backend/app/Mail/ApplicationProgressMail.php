<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ApplicationProgressMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $applicantName;
    public string $applicationId;
    public string $currentStepName;
    public string $nextStepName;

    public function __construct(string $applicantName, string $applicationId, string $currentStepName, string $nextStepName)
    {
        $this->applicantName   = $applicantName;
        $this->applicationId   = $applicationId;
        $this->currentStepName = $currentStepName;
        $this->nextStepName    = $nextStepName;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Application Status Update: Moved to ' . $this->nextStepName,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.application_progress',
        );
    }

}
