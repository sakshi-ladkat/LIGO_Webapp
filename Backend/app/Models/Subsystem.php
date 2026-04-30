<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Subsystem extends Model
{

    protected $fillable = [
        'system_id',
        'name',
        'code',
        'type',
        'description',
        'is_active'
    ];
    protected $casts = [
        'is_active' => 'boolean'
    ];

    public function system()
    {
        return $this->belongsTo(System::class);
    }

    public function leadAssignment()
    {
        return $this->hasOne(EntityAssignment::class, 'entity_id')
            ->where('entity_type', 'subsystem')
            ->where('is_active', true);
    }
}