<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApplicationLog extends Model
{
    protected $fillable = [
        'application_id',
        'workflow_step_id',
        'action_by',
        'action',
        'remarks',
    ];

    public function application()
    {
        return $this->belongsTo(Application::class, 'application_id', 'id');
    }

    public function actor()
    {
        return $this->belongsTo(User::class, 'action_by', 'user_id');
    }
}
