<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Institute extends Model
{
    use HasFactory;
    protected $fillable = ['name', 'code', 'city', 'is_active'];
    protected $casts    = ['is_active' => 'boolean'];

    public function systems() { return $this->hasMany(System::class); }
    public function users()   { return $this->hasMany(User::class); }
}
