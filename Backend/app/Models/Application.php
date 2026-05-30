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
        'paused_workflow_step',
        'current_assignee_id',
        'status',
        'is_active',
        'ligo_member',
        'ligo_us_member',
        'ligo_india_member',
        'assigned_system_id',
        'assigned_subsystem_id',
        'computing_services',
        'profile_snapshot',
        'id_card_path',
        'is_id_approved',
        'id_card_approved_by',
        'id_card_approved_at',

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