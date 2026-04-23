<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApplicationReminder extends Model
{
    protected $fillable = [
        'application_id',
        'role',
        'sent_at',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
    ];

    public function application()
    {
        return $this->belongsTo(Application::class);
    }
}
