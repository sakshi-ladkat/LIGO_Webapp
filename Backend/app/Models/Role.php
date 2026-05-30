<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Role extends Model
{


    protected $fillable = [
        'name',
        'slug',
        'description',
        'level',
        'is_active'
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'level' => 'integer',
    ];

    public function permissions()
    {
        return $this->belongsToMany(Permission::class, 'roles_permissions');
    }

    public function users()
    {
        return $this->belongsToMany(User::class, 'user_roles');
    }
}