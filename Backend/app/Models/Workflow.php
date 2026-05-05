<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Workflow extends Model
{
    protected $primaryKey = 'workflow_id';

    protected $fillable = [
        'workflow_name',
        'workflow_description',
        'is_active',
        'version',
        'is_latest',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_latest' => 'boolean',
        'version'   => 'integer',
    ];

    /**
     * All steps belonging to this workflow.
     */
    public function steps(): HasMany
    {
        return $this->hasMany(WorkflowStep::class, 'workflow_id', 'workflow_id')
                    ->orderBy('step_no');
    }

    /**
     * Clone this workflow into a new version.
     * Steps are NOT copied automatically — call copyStepsTo() separately.
     */
    public function cloneAsNewVersion(): self
    {
        $new = $this->replicate();
        $new->version   = $this->version + 1;
        $new->is_latest = true;
        $new->is_active = true;
        $new->save();

        return $new;
    }

    /**
     * Copy all steps from this workflow into the target workflow.
     */
    public function copyStepsTo(self $target): void
    {
        foreach ($this->steps as $step) {
            $target->steps()->create([
                'step_no'     => $step->step_no,
                'role_id'     => $step->role_id,
                'step_action' => $step->step_action,
                'status_name' => $step->status_name,
                'is_final_step' => $step->is_final_step,
                'is_active'   => $step->is_active,
            ]);
        }
    }
}
