<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InstituteTransferRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'from_institute_id',
        'to_institute_id',
        'status',
        'rejection_reason',
    ];
}
