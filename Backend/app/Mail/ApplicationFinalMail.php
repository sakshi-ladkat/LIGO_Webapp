<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ApplicationFinalMail extends Mailable
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
            subject: 'Application Fully Approved! - OrbitAccess',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.application_final',
        );
    }

}
