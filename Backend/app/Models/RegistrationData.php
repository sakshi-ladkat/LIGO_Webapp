<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RegistrationData extends Model
{
    use HasFactory;

    protected $table = 'registration_data';

    protected $fillable = [
        'email',
        'institute_id',
        'first_name',
        'middle_name',
        'last_name',
        'suffix',
        'address_line1',
        'address_line2',
        'address_line3',
        'city',
        'state',
        'postal_code',
        'continent',
        'country',
        'office_country_code',
        'office_city_code',
        'office_number',
        'fax_number',
        'status',
        'email_verified_at',
        'password_set_at',
        'user_id',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password_set_at' => 'datetime',
    ];

    /**
     * Get the institute for this registration
     */
    public function institute()
    {
        return $this->belongsTo(Institute::class);
    }

    /**
     * Get the user associated with this registration
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get full name
     */
    public function getFullNameAttribute()
    {
        $name = trim($this->first_name . ' ' . $this->middle_name . ' ' . $this->last_name);
        return $this->suffix ? $name . ', ' . $this->suffix : $name;
    }

    /**
     * Get full office phone
     */
    public function getFullOfficePhoneAttribute()
    {
        $phone = '+' . $this->office_country_code;
        if ($this->office_city_code) {
            $phone .= ' (' . $this->office_city_code . ')';
        }
        $phone .= ' ' . $this->office_number;
        return $phone;
    }
}
