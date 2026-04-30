<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ApplicationSubmissionMail extends Mailable
{
    use Queueable, SerializesModels;

    public $applicantName;
    public $applicationId;
    public $workflowName;

    public function __construct($applicantName, $applicationId, $workflowName)
    {
        $this->applicantName = $applicantName;
        $this->applicationId = $applicationId;
        $this->workflowName = $workflowName;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'New Application Submitted: ' . $this->applicationId,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.application_submission',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
