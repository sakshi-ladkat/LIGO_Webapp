<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class System extends Model
{
    use HasFactory;

    protected $fillable = [
        'name', 
        'code', 
        'description', 
        'is_active'
        ];
    protected $casts    = [
        'is_active' => 'boolean'
        ];

    /**
     * A system belongs to many institutes (via institute_system pivot).
     */
    public function institutes()
    {
        return $this->belongsToMany(Institute::class, 'institute_system')
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
