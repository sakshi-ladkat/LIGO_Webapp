<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserContact extends Model
{
    protected $table = 'user_contacts';

    protected $fillable = [
        'user_id',
        'continent_name',
        'country_name',
        'address_line_1',
        'address_line_2',
        'address_line_3',
        'city',
        'state',
        'postal_code',
        'country_code',
        'city_code',
        'phone_number',
        'fax_number',
        'additional_metadata',
    ];

    protected $casts = [
        'additional_metadata' => 'array',
    ];

    /**
     * Get the user that owns the contact information.
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }
}
