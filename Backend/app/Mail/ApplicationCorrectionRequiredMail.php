<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ApplicationCorrectionRequiredMail extends Mailable
{
    use Queueable, SerializesModels;

    public $applicantName;
    public $applicationId;
    public $reasons;
    public $remarks;

    /**
     * Create a new message instance.
     */
    public function __construct($applicantName, $applicationId, $reasons, $remarks = '')
    {
        $this->applicantName = $applicantName;
        $this->applicationId = $applicationId;
        $this->reasons = $reasons;
        $this->remarks = $remarks;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'OrbitAccess - Correction Required for Application #' . $this->applicationId,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.application_correction',
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}
