<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class WorkflowStep extends Model
{
    protected $primaryKey = 'workflow_step_id';

    protected $fillable = [
        'workflow_id',
        'step_no',
        'role_id',
        'status_id',
        'is_final_step',
        'is_active',
    ];

    protected $casts = [
        'is_active'    => 'boolean',
        'is_final_step' => 'boolean',
    ];

    /** The workflow this step belongs to. */
    public function workflow(): BelongsTo
    {
        return $this->belongsTo(Workflow::class, 'workflow_id', 'workflow_id');
    }

    /**
     * Actions this step can perform (many-to-many via workflow_step_actions).
     * A step may allow multiple actions e.g. Approve + Recommend simultaneously.
     */
    public function actions(): BelongsToMany
    {
        return $this->belongsToMany(
            WorkflowAction::class,
            'workflow_step_actions',
            'workflow_step_id',
            'action_id',
            'workflow_step_id',
            'id'
        );
    }
}
