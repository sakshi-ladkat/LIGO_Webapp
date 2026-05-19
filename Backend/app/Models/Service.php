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
        'is_ligo',
        'ldap_dn',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_ligo'   => 'boolean',
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
