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
        return $this->belongsToMany(Role::class, 'user_roles', 'user_id', 'role_id')->withPivot('is_active');
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

    public function affiliations()
    {
        return $this->belongsToMany(Institute::class, 'user_affilation', 'user_id', 'institute_id')
            ->withPivot('category_id', 'is_active')
            ->withTimestamps();
    }

    public function affiliatedCategories()
    {
        return $this->belongsToMany(Category::class, 'user_affilation', 'user_id', 'category_id')
            ->withPivot('institute_id', 'is_active')
            ->withTimestamps();
    }

    public function profile()
    {
        return $this->hasOne(UserProfile::class, 'user_id', 'user_id');
    }

    public function qualifications()
    {
        return $this->hasMany(UserQualification::class, 'user_id', 'user_id');
    }

    public function contacts()
    {
        return $this->hasMany(UserContact::class, 'user_id', 'user_id');
    }

    public function refreshTokens()
    {
        return $this->hasMany(RefreshToken::class, 'user_id', 'user_id');
    }
}
