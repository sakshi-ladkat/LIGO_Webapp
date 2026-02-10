<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Continent extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'code',
        'is_active',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Get all countries for this continent.
     */
    public function countries(): HasMany
    {
        return $this->hasMany(Country::class);
    }

    /**
     * Get only active countries for this continent.
     */
    public function activeCountries(): HasMany
    {
        return $this->hasMany(Country::class)->where('is_active', true);
    }

    /**
     * Scope to get only active continents.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
