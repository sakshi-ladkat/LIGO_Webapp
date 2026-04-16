<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReferenceController extends Controller
{
    /**
     * Get all categories which have a parent_id (excluding root categories)
     */
    public function getCategories(): JsonResponse
    {
        // User specifically requested to fetch category where id is not NULL
        $categories = Category::whereNotNull('id')->get(['id', 'name']);
        return response()->json($categories);
    }

    /**
     * Get all users who have the role "supervisor", optionally filtered by institute
     */
    public function getSupervisors(Request $request): JsonResponse
    {
        $instituteId = $request->query('institute_id');

        $supervisors = User::whereHas('roles', function ($q) {
            $q->where('slug', 'supervisor')->orWhere('name', 'supervisor');
        });

        if ($instituteId) {
            $supervisors->whereHas('affiliations', function ($q) use ($instituteId) {
                // Ensure we specify the table for institute_id just in case
                $q->where('user_affilation.institute_id', $instituteId);
            });
        }

        // Ideally we fetch the profile to get the supervisor's name too
        $results = $supervisors->with('profile')->get()->map(function ($user) {
            $name = 'N/A';
            if ($user->profile) {
                // Fallbacks since we don't know the exact columns of UserProfile yet
                $name = trim(($user->profile->first_name ?? '') . ' ' . ($user->profile->last_name ?? ''));
                if (!$name) {
                    $name = $user->profile->name ?? 'Supervisor';
                }
            }

            return [
            'id' => $user->user_id,
            'name' => $name,
            'email' => $user->email,
            ];
        });

        return response()->json($results);
    }
}