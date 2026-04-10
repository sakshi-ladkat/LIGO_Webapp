<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SystemRequest extends Model
{
    protected $table = 'requests';

    protected $fillable = [
        'name',
        'type',
    ];

    public function users()
    {
        return $this->belongsToMany(User::class, 'user_requests', 'request_id', 'user_id')
                    ->using(UserRequest::class)
                    ->withPivot('is_active')
                    ->withTimestamps();
    }
}
