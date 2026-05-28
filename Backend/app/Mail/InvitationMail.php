<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class InvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    public string $token;
    public string $role;
    public string $inviteUrl;
    public string $createdAt;
    public string $expiresAt;

    /**
     * Create a new message instance.
     */
    public function __construct(string $token, string $role, $createdAt = null, $expiresAt = null)
    {
        $this->token = $token;
        $this->role = $role;

        // Resolve frontend URL dynamically from configurations
        $baseUrl = config('app.frontend_url', config('app.url', 'http://localhost:8000'));
        $this->inviteUrl = rtrim($baseUrl, '/') . '/#/login?invite=true';

        // Format dates beautifully
        $this->createdAt = $createdAt ? \Carbon\Carbon::parse($createdAt)->format('F j, Y, g:i a') : \Carbon\Carbon::now()->format('F j, Y, g:i a');
        $this->expiresAt = $expiresAt ? \Carbon\Carbon::parse($expiresAt)->format('F j, Y, g:i a') : \Carbon\Carbon::now()->addDays(7)->format('F j, Y, g:i a');
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Invitation to Join ' . config('app.name'),
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.invitation',
        );
    }

    /**
     * Get the attachments for the message.
     */
    public function attachments(): array
    {
        return [];
    }
}
