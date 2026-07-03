<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class PendingReminderMail extends Mailable
{
    use Queueable, SerializesModels;

    public $applicationId;
    public $role;

    public function __construct($applicationId, $role)
    {
        $this->applicationId = $applicationId;
        $this->role = $role;
    }

    public function envelope(): \Illuminate\Mail\Mailables\Envelope
    {
        return new \Illuminate\Mail\Mailables\Envelope(
            subject: 'Reminder: Pending Application Needs Review',
        );
    }

    public function content(): \Illuminate\Mail\Mailables\Content
    {
        return new \Illuminate\Mail\Mailables\Content(
            view: 'emails.pending_reminder',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
