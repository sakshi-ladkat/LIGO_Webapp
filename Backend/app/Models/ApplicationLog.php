<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApplicationLog extends Model
{
    protected $table = 'application_workflow_logs';

    protected $fillable = [
        'application_id',
        'workflow_step_id',
        'action_by',
        'role',
        'previous_status',
        'new_status',
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
