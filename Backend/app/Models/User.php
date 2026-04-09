<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;


class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, HasUlids;

    protected $primaryKey = 'user_id';

     protected $fillable = [
        'email',
        'status',
        'remember_token'
    ];

   
    public function roles()
    {
        return $this->belongsToMany(Role::class, 'user_roles', 'user_id', 'role_id');
    }

    public function supervisors()
    {
        return $this->belongsToMany(User::class, 'user_supervisors', 'user_id', 'supervisor_id')
                    ->withPivot('is_active')
                    ->withTimestamps();
    }

    public function subordinates()
    {
        return $this->belongsToMany(User::class, 'user_supervisors', 'supervisor_id', 'user_id')
                    ->withPivot('is_active')
                    ->withTimestamps();
    }

    public function requests()
    {
        return $this->belongsToMany(SystemRequest::class, 'user_requests', 'user_id', 'request_id')
                    ->withPivot('is_active')
                    ->withTimestamps();
    }

    public function affiliation()
    {
        // Assuming user affiliation maps to the Institute model via institute_id
        return $this->belongsTo(Institute::class, 'institute_id');
    }
}
