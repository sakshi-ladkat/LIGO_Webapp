<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Class MailLog
 * 
 * Logs outgoing emails and their delivery statuses.
 *
 * @package App\Models
 */
class MailLog extends Model
{
    protected $fillable = [
        'recipient_email',
        'subject',
        'template_name',
        'status',
        'error_message',
        'user_id'
    ];

    /**
     * Get the user associated with this mail log (if any).
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }
}
