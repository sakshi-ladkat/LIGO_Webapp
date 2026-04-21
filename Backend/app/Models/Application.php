<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Application extends Model
{
    protected $fillable = [
        'application_id',
        'user_id',
        'request_id',
        'workflow_id',
        'current_step_id',
        'status',
        'is_active',
    ];

    public function user()
    {
        return $this->belongsTo(User::class , 'user_id', 'user_id');
    }

    public function workflow()
    {
        return $this->belongsTo(Workflow::class , 'workflow_id', 'workflow_id');
    }

    public function logs()
    {
        return $this->hasMany(ApplicationLog::class , 'application_id', 'id');
    }
}