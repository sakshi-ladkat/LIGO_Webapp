<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ApplicationApprovalMail extends Mailable
{
    use Queueable, SerializesModels;

    public $applicantName;
    public $applicationId;
    public $currentStatus;

    public function __construct($applicantName, $applicationId, $currentStatus)
    {
        $this->applicantName = $applicantName;
        $this->applicationId = $applicationId;
        $this->currentStatus = $currentStatus;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Application Approval Required: ' . $this->applicationId,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.application_approval',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
