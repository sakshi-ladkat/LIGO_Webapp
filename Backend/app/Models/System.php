<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class System extends Model
{


    protected $fillable = [
        'name',
        'code',
        'type',
        'description',
        'institute_id',
        'is_active'
    ];
    protected $casts = [
        'is_active' => 'boolean'
    ];

    public function leadAssignment()
    {
        return $this->hasOne(EntityAssignment::class, 'entity_id')
            ->where('entity_type', 'system')
            ->where('is_active', true);
    }

    public function institute()
    {
        return $this->belongsTo(Institute::class);
    }

    /**
     * A system belongs to many institutes (via institute_system pivot).
     */
    public function institutes()
    {
        return $this->belongsToMany(Institute::class , 'institute_system')
            ->withTimestamps();
    }

    /**
     * A system has many sub-systems.
     */
    public function subSystems()
    {
        return $this->hasMany(SubSystem::class);
    }
}