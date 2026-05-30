<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowStep extends Model
{
    protected $primaryKey = 'workflow_step_id';

    protected $fillable = [
        'workflow_id',
        'step_no',
        'role_id',
        'action_id',
        'status_id',
        'is_final_step',
        'is_active',
    ];

    protected $casts = [
        'is_active'    => 'boolean',
        'is_final_step' => 'boolean',
    ];

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(Workflow::class, 'workflow_id', 'workflow_id');
    }
}
