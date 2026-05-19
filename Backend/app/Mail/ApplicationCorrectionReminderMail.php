<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ApplicationCorrectionReminderMail extends Mailable
{
    use Queueable, SerializesModels;

    public $applicantName;
    public $applicationId;
    public $remarks;

    /**
     * Create a new message instance.
     */
    public function __construct($applicantName, $applicationId, $remarks)
    {
        $this->applicantName = $applicantName;
        $this->applicationId = $applicationId;
        $this->remarks = $remarks;
    }

    /**
     * Build the message.
     */
    public function build()
    {
        return $this->subject('Action Required: Application Correction Reminder')
                    ->html("
                        <div style='font-family: \"Inter\", sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);'>
                            <div style='background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center;'>
                                <h1 style='color: white; margin: 0; font-size: 24px;'>Correction Reminder</h1>
                            </div>
                            <div style='padding: 40px; background: white; color: #1e293b;'>
                                <p style='font-size: 16px; margin-top: 0;'>Hello <strong>{$this->applicantName}</strong>,</p>
                                <p style='font-size: 15px; line-height: 1.6;'>This is a friendly reminder that your application (<strong>#{$this->applicationId}</strong>) is currently awaiting correction. Action is required from your side to move the application forward in the review process.</p>
                                
                                <div style='background: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 4px;'>
                                    <strong style='color: #92400e; display: block; margin-bottom: 5px; font-size: 13px; text-transform: uppercase;'>Reviewer Remarks:</strong>
                                    <p style='color: #451a03; margin: 0; font-size: 14px; font-style: italic;'>\"{$this->remarks}\"</p>
                                </div>

                                <p style='font-size: 15px; line-height: 1.6;'>Please log in to your dashboard at your earliest convenience to review the flagged fields and resubmit.</p>
                                
                                <div style='text-align: center; margin: 35px 0;'>
                                    <a href='http://192.168.11.127:5173/#/dashboard' style='background: #d97706; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block;'>Access Dashboard</a>
                                </div>

                                <hr style='border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;'>
                                <p style='font-size: 12px; color: #64748b; text-align: center;'>OrbitAccess Research Management System</p>
                            </div>
                        </div>
                    ");
    }
}
