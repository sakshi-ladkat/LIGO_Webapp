<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserContact;
use App\Models\UserProfile;
use App\Models\UserAffilation;
use Illuminate\Support\Facades\DB;

class DuplicateApplicantService
{
    /**
     * Normalize a name by removing special characters, spaces, and converting to lowercase.
     */
    public function normalizeName($firstName, $middleName = '', $lastName = '')
    {
        $full = trim($firstName . ' ' . ($middleName ?? '') . ' ' . $lastName);
        $full = strtolower($full);
        $full = preg_replace('/[^a-z0-9\s]/', '', $full);
        $full = preg_replace('/\s+/', ' ', $full);
        return trim($full);
    }

    /**
     * Calculate a soundex-based key for fuzzy matching.
     */
    public function calculateSoundex($name)
    {
        if (empty($name)) return null;
        $words = explode(' ', $name);
        $sounds = array_map('soundex', $words);
        return substr(implode('', $sounds), 0, 10);
    }

    /**
     * Update normalized fields for a profile.
     */
    public function updateNormalizedFields(UserProfile $profile)
    {
        $normalized = $this->normalizeName($profile->first_name, $profile->middle_name, $profile->last_name);
        $profile->normalized_full_name = $normalized;
        $profile->soundex_name = $this->calculateSoundex($normalized);
        $profile->save();
    }

    /**
     * Find possible duplicates for a given application.
     */
    public function findPossibleDuplicates($application)
    {
        $applicant = $application->user; // Assuming application has a user relationship
        if (!$applicant) return [];

        $profile = $applicant->profile;
        if (!$profile) return [];

        // Ensure normalized fields are up to date
        if (empty($profile->normalized_full_name)) {
            $this->updateNormalizedFields($profile);
        }

        $potentialMatches = UserProfile::where('user_id', '!=', $applicant->id)
            ->where(function ($query) use ($profile) {
                $query->where('normalized_full_name', $profile->normalized_full_name)
                    ->orWhere('soundex_name', $profile->soundex_name);
            })
            ->get();

        $results = [];
        foreach ($potentialMatches as $match) {
            $score = $this->calculateRiskScore($applicant, $match->user);
            if ($score['risk'] !== 'none') {
                $results[] = [
                    'matched_user_id' => $match->user_id,
                    'profile' => $match,
                    'risk_level' => $score['risk'],
                    'reasons' => $score['reasons'],
                    'similarity' => $score['similarity']
                ];
            }
        }

        return $results;
    }

    /**
     * Find possible duplicates by user ID.
     */
    public function findDuplicatesByUserId(string $userId)
    {
        $applicant = User::where('user_id', $userId)->first();
        if (!$applicant) return [];

        $profile = $applicant->profile;
        if (!$profile) return [];

        // Ensure normalized fields are up to date
        if (empty($profile->normalized_full_name)) {
            $this->updateNormalizedFields($profile);
        }

        $potentialMatches = UserProfile::where('user_id', '!=', $applicant->user_id)
            ->where(function ($query) use ($profile) {
                $query->where('normalized_full_name', $profile->normalized_full_name)
                    ->orWhere('soundex_name', $profile->soundex_name);
            })
            ->get();

        $results = [];
        foreach ($potentialMatches as $match) {
            $matchedUser = User::where('user_id', $match->user_id)->first();
            if (!$matchedUser) continue;
            
            $score = $this->calculateRiskScore($applicant, $matchedUser);
            if ($score['risk'] !== 'none') {
                $results[] = [
                    'matched_user_id' => $match->user_id,
                    'profile' => $match,
                    'risk_level' => $score['risk'],
                    'reasons' => $score['reasons'],
                    'similarity' => $score['similarity']
                ];
            }
        }

        return $results;
    }


    /**
     * Calculate a risk score between two users.
     */
    public function calculateRiskScore($user1, $user2)
    {
        $p1 = $user1->profile;
        $p2 = $user2->profile;
        $a1 = $user1->affilation; // Note: typo in original project 'affilation'
        $a2 = $user2->affilation;
        $c1 = $user1->contact;
        $c2 = $user2->contact;

        $reasons = [];
        $risk = 'none';
        
        // 1. Name Similarity
        similar_text($p1->normalized_full_name, $p2->normalized_full_name, $percent);
        
        $sameName = ($p1->normalized_full_name === $p2->normalized_full_name);
        $sameAffiliation = ($a1 && $a2 && $a1->institute_id === $a2->institute_id);
        $sameMobile = ($c1 && $c2 && !empty($c1->phone_number) && $c1->phone_number === $c2->phone_number);

        if ($sameName && ($sameAffiliation || $sameMobile)) {
            $risk = 'high';
            $reasons[] = "Exact name match with same " . ($sameAffiliation ? "affiliation" : "mobile number");
        } elseif ($sameName) {
            $risk = 'medium';
            $reasons[] = "Exact name match";
        } elseif ($percent > 85) {
            $risk = 'low';
            $reasons[] = "High fuzzy name similarity (" . round($percent, 1) . "%)";
        }

        return [
            'risk' => $risk,
            'reasons' => $reasons,
            'similarity' => round($percent, 1)
        ];
    }
}
