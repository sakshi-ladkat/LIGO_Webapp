<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Application extends Model
{
    protected $fillable = [
        'application_id',
        'user_id',
        'parent_application_id',
        'reapplied_from',
        'request_id',
        'workflow_id',
        'current_step_id',
        'status',
        'current_stage',
        'declined_reason',
        'is_active',

    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function parent()
    {
        return $this->belongsTo(Application::class, 'parent_application_id', 'id');
    }

    public function reapplications()
    {
        return $this->hasMany(Application::class, 'parent_application_id', 'id');
    }


    public function workflow()
    {
        return $this->belongsTo(Workflow::class, 'workflow_id', 'workflow_id');
    }

    public function logs()
    {
        return $this->hasMany(ApplicationLog::class, 'application_id', 'id');
    }

    public function reminders()
    {
        return $this->hasMany(ApplicationReminder::class, 'application_id', 'id');
    }
}