<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserAffiliation extends Model
{
    protected $table = 'user_affiliations';

    protected $fillable = [
        'user_id',
        'current_affiliation',
        'affiliated_organization',
        'country',
        'position_role',
        'start_date',
        'end_date'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
