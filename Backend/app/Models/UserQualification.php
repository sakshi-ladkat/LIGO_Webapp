<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserQualification extends Model
{
    protected $table = 'user_qualification';

    protected $fillable = [
        'user_id',
        'highest_qualification',
        'field_of_study',
        'university',
        'graduation_year',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Get the user that owns the qualification.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }
}
