<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Institute extends Model
{
    use HasFactory;

    protected $fillable = [
    'name', 
    'code', 
    'city', 
    'is_active'];

    protected $casts    = [
        'is_active' => 'boolean'
        ];

    /**
     * An institute has many systems (via institute_system pivot).
     */
    public function systems()
    {
        return $this->belongsToMany(System::class, 'institute_system')
                    ->withTimestamps();
    }

    public function users()
    {
        return $this->hasMany(User::class);
    }
}
