<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Subservice extends Model
{
    protected $fillable = [
        'name',
        'code',
        'type',
        'description',
        'service_id',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function service()
    {
        return $this->belongsTo(Service::class);
    }
}
