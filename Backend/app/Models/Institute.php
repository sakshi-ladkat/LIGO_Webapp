<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Institute extends Model
{


    protected $fillable = [
        'name',
        'code',
        'city',
        'is_active',
        'ldap_dn',
        'has_li_coordinator',
        'normalized_name',
        'is_user_suggested',
        'created_by',
        'modified_by',
        'status'
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'has_li_coordinator' => 'boolean',
        'is_user_suggested' => 'boolean'
    ];

    /**
     * An institute has many systems (via institute_system pivot).
     */
    public function systems()
    {
        return $this->belongsToMany(System::class , 'institute_system')
            ->withTimestamps();
    }

    public function users()
    {
        return $this->belongsToMany(User::class, 'user_affilation', 'institute_id', 'user_id')
            ->withPivot('category_id', 'is_active')
            ->withTimestamps();
    }
}