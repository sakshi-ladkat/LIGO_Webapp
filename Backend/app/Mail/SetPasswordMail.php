<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class SetPasswordMail extends Mailable
{
    use Queueable, SerializesModels;

    public $link;
    public $name;

    /**
     * Create a new message instance.
     */
    public function __construct($link, $name)
    {
        $this->link = $link;
        $this->name = $name;
    }

    /**
     * Build the message.
     */
    public function build()
    {
        return $this->subject('Set Your Password - Complete Registration')
                    ->view('emails.set-password');
    }
}
