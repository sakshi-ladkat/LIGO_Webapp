<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class System extends Model
{
    use HasFactory;
    protected $fillable = ['institute_id', 'name', 'code', 'description', 'is_active'];
    protected $casts    = ['is_active' => 'boolean'];

    public function institute()  { return $this->belongsTo(Institute::class); }
    public function subSystems() { return $this->hasMany(SubSystem::class); }
}
