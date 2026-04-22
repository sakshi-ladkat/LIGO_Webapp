<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

class UserRequest extends Pivot
{
    protected $table = 'user_requests';

    public $incrementing = false;

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class , 'user_id', 'user_id');
    }
}