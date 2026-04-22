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
        'subsystem_lead_id',
        'is_active'
    ];
    protected $casts = [
        'is_active' => 'boolean'
    ];

    public function system()
    {
        return $this->belongsTo(System::class);
    }

    public function lead()
    {
        return $this->belongsTo(User::class, 'subsystem_lead_id', 'user_id');
    }
}