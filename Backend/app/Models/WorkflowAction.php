<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Represents a single action that a reviewer can take on a workflow step.
 * Examples: approve, recommend, reject, approve_identity
 */
class WorkflowAction extends Model
{
    protected $fillable = ['name', 'slug'];

    /**
     * The workflow steps that use this action (via pivot).
     */
    public function steps(): BelongsToMany
    {
        return $this->belongsToMany(
            WorkflowStep::class,
            'workflow_step_actions',
            'action_id',
            'workflow_step_id',
            'id',
            'workflow_step_id'
        );
    }
}
