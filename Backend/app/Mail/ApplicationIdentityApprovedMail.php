<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ApplicationIdentityApprovedMail extends Mailable
{
    use Queueable, SerializesModels;

    public $name;
    public $applicationId;

    public function __construct($name, $applicationId)
    {
        $this->name = $name;
        $this->applicationId = $applicationId;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Identity Verification Approved - OrbitAccess',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.application_identity_approved',
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
