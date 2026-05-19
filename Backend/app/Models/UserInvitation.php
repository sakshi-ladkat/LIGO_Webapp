<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserInvitation extends Model
{
    protected $table = 'user_invitations';

    protected $fillable = [
        'email',
        'token',
        'invited_by',
        'invited_user_id',
        'role',
        'status',
        'expires_at',
        'accepted_at'
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'accepted_at' => 'datetime',
    ];

    /**
     * Relationship with the User who sent the invitation (Supervisor).
     */
    public function invitedBy()
    {
        return $this->belongsTo(User::class, 'invited_by', 'user_id');
    }

    /**
     * Relationship with the registered User once accepted.
     */
    public function invitedUser()
    {
        return $this->belongsTo(User::class, 'invited_user_id', 'user_id');
    }

    /**
     * Relationship with the activity logs for this invitation.
     */
    public function logs()
    {
        return $this->hasMany(InvitationLog::class, 'invitation_id', 'id');
    }
}
