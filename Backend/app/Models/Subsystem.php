<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Subsystem extends Model
{
     use HasFactory;
    protected $fillable = [
        'system_id', 
        'name', 
        'code', 
        'description', 
        'is_active'
        ];
    protected $casts    = [
        'is_active' => 'boolean'
        ];

    public function system() { return $this->belongsTo(System::class); }
}
