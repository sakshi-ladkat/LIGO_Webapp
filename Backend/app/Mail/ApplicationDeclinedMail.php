<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ApplicationDeclinedMail extends Mailable
{
    use Queueable, SerializesModels;

    public $name;
    public $applicationId;
    public $reason;

    /**
     * Create a new message instance.
     */
    public function __construct($name, $applicationId, $reason)
    {
        $this->name = $name;
        $this->applicationId = $applicationId;
        $this->reason = $reason;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'OrbitAccess - Application Declined',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.application_rejection',
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
