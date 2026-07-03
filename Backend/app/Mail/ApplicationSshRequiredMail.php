<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ApplicationSshRequiredMail extends Mailable
{
    use Queueable, SerializesModels;

    public $applicantName;
    public $applicationId;

    public function __construct($applicantName, $applicationId)
    {
        $this->applicantName = $applicantName;
        $this->applicationId = $applicationId;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Action Required: Upload SSH Key - OrbitAccess',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.application_ssh_required',
        );
    }
}
