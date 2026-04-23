<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RefreshToken extends Model
{
    protected $fillable = [
        'user_id',
        'token_hash',
        'device_id',
        'user_agent',
        'ip',
        'is_active',
        'expires_at',
        'revoked_at',
    ];

    protected $casts = [
        'is_active'  => 'boolean',
        'expires_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    /**
     * Get the user this token belongs to.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    /**
     * Scope: only active (not revoked and not expired) tokens.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true)
                     ->whereNull('revoked_at')
                     ->where('expires_at', '>', now());
    }

    /**
     * Whether the token has been revoked.
     */
    public function isRevoked(): bool
    {
        return !is_null($this->revoked_at);
    }

    /**
     * Whether the token has expired.
     */
    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    /**
     * Whether the token is still valid.
     */
    public function isValid(): bool
    {
        return $this->is_active && !$this->isRevoked() && !$this->isExpired();
    }
}
