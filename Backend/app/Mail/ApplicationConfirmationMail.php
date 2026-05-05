<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ApplicationConfirmationMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $applicantName;
    public string $applicationId;
    public string $workflowName;

    public function __construct(string $applicantName, string $applicationId, string $workflowName)
    {
        $this->applicantName = $applicantName;
        $this->applicationId = $applicationId;
        $this->workflowName  = $workflowName;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Application Submitted Successfully — ' . $this->applicationId,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.application_confirmation',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
