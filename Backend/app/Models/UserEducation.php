<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserEducation extends Model
{
    protected $table = 'user_education';

    protected $fillable = [
        'user_id',
        'degree_level',
        'degree_title',
        'specialization',
        'institute_name',
        'institute_country',
        'start_date',
        'end_date',
        'grading_system',
        'grade_value',
        'is_current'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
