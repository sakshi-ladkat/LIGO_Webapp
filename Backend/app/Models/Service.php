<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Service extends Model
{
    protected $fillable = [
        'name',
        'code',
        'type',
        'description',
        'subsystem_id',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function subsystem()
    {
        return $this->belongsTo(Subsystem::class);
    }

    public function subservices()
    {
        return $this->hasMany(Subservice::class);
    }
}
