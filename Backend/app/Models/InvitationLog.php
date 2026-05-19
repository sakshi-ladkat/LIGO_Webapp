<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InvitationLog extends Model
{
    protected $table = 'invitation_logs';

    protected $fillable = [
        'invitation_id',
        'action',
        'performed_by',
        'remarks'
    ];

    /**
     * Relationship with the associated invitation.
     */
    public function invitation()
    {
        return $this->belongsTo(UserInvitation::class, 'invitation_id', 'id');
    }

    /**
     * Relationship with the User who performed the action.
     */
    public function performedBy()
    {
        return $this->belongsTo(User::class, 'performed_by', 'user_id');
    }
}
