<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ApplicationCorrectionReminderMail extends Mailable
{
    use Queueable, SerializesModels;

    public $applicantName;
    public $applicationId;
    public $remarks;

    /**
     * Create a new message instance.
     */
    public function __construct($applicantName, $applicationId, $remarks)
    {
        $this->applicantName = $applicantName;
        $this->applicationId = $applicationId;
        $this->remarks = $remarks;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Action Required: Application Correction Reminder',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.application_correction',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
