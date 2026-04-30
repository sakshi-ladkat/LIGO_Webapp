<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EntityAssignment extends Model
{
    protected $fillable = [
        'entity_type',
        'entity_id',
        'user_id',
        'is_active',
        'assigned_at',
        'deactivated_at'
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }
}
