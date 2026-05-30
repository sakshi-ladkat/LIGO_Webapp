<?php

namespace App\Listeners;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Events\MessageSent;
use Illuminate\Queue\InteractsWithQueue;

class LogSentMessage
{
    /**
     * Create the event listener.
     */
    public function __construct()
    {
        //
    }

    /**
     * Handle the event.
     */
    public function handle(MessageSent $event): void
    {
        $message = $event->message;

        $recipientEmails = [];
        if ($message->getTo()) {
            foreach ($message->getTo() as $address) {
                $recipientEmails[] = $address->getAddress();
            }
        }

        // We can optionally infer user_id if we want, but for now we store the email
        // and subject to avoid full body storage as requested.
        
        \App\Models\MailLog::create([
            'recipient_email' => implode(', ', $recipientEmails),
            'subject' => $message->getSubject(),
            'template_name' => null, // The event doesn't cleanly expose the view name, but we save space!
            'status' => 'sent',
        ]);
    }
}
