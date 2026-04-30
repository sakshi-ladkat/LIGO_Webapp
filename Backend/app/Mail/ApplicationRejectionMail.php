<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ApplicationRejectionMail extends Mailable
{
    use Queueable, SerializesModels;

    public $applicantName;
    public $applicationId;
    public $reason;
    public $action;

    public function __construct($applicantName, $applicationId, $reason, $action)
    {
        $this->applicantName = $applicantName;
        $this->applicationId = $applicationId;
        $this->reason = $reason;
        $this->action = $action;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Update Regarding Your Application - ' . $this->applicationId,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.application_rejection',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
