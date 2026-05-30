<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Class LdapSyncLog
 * 
 * Tracks the success, metrics, and errors of LDAP synchronization batches.
 *
 * @package App\Models
 */
class LdapSyncLog extends Model
{
    protected $fillable = [
        'batch_id',
        'status',
        'users_processed',
        'users_added',
        'users_updated',
        'users_failed',
        'errors',
        'duration_ms',
        'started_at',
        'completed_at',
    ];

    protected $casts = [
        'errors' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];
}
