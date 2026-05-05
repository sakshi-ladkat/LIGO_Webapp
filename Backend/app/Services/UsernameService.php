<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class UsernameService
{
    /**
     * Generate a unique username for the user.
     * Logic: firstname.lastname -> firstname.lastname.m -> firstname.lastname.mNN
     */
    public function generateUnique(string $firstName, string $lastName, ?string $middleName = null): string
    {
        $firstName = $this->sanitize($firstName);
        $lastName = $this->sanitize($lastName);
        
        // Base: firstname.lastname
        $base = strtolower($firstName . '.' . $lastName);
        
        // 1. Check base
        if (!$this->exists($base)) {
            return $base;
        }

        // 2. Try with middle initial
        if ($middleName) {
            $initial = strtolower(substr($this->sanitize($middleName), 0, 1));
            $withInitial = $base . '.' . $initial;
            if (!$this->exists($withInitial)) {
                return $withInitial;
            }
            $base = $withInitial;
        }

        // 3. Fallback: Append random number
        do {
            $candidate = $base . rand(10, 99);
        } while ($this->exists($candidate));

        return $candidate;
    }

    private function sanitize(string $name): string
    {
        return preg_replace('/[^a-zA-Z0-9]/', '', $name);
    }

    /**
     * Bloom Filter inspired check + DB verification.
     */
    private function exists(string $username): bool
    {
        // Bloom Filter: In a real distributed system, we'd check Redis/Bitset here.
        // For this task, we'll simulate the "mightContain" by checking a cache or just DB.
        
        return User::where('username', $username)->exists() || 
               DB::table('users')->where('username', $username)->exists();
    }
}
