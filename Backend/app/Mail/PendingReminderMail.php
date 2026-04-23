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

    public function build()
    {
        return $this->subject('Reminder: Pending Application Needs Review')
                    ->html("<p>This is an automated reminder that application ID <strong>{$this->applicationId}</strong> is still pending action for the <strong>{$this->role}</strong> role.</p>");
    }
}
