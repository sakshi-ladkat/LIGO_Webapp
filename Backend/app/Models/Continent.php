<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Continent extends Model
{
    protected $fillable = [
        'name',
        'code',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function countries()
    {
        return $this->hasMany(Country::class);
    }
}