<?php

namespace App\Http\Controllers;

use App\Models\Category;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use App\Models\Title;

class ReferenceController extends Controller
{
    /**
     * Get all categories which have a parent_id (excluding root categories)
     */
    public function getCategories(): JsonResponse
    {
        // User specifically requested to fetch category where id is not NULL
        $categories = Category::whereNotNull('parent_id')->get(['id', 'name']);
        return response()->json($categories);
    }

    /**
     * Get all users who have the role "supervisor", optionally filtered by institute
     */
    public function getSupervisors(): JsonResponse
    {
        $supervisors = DB::table('users')
            ->join('user_roles', 'users.user_id', '=', 'user_roles.user_id')
            ->join('roles', 'user_roles.role_id', '=', 'roles.id')
            ->join('user_profiles', 'users.user_id', '=', 'user_profiles.user_id')
            ->where('roles.slug', 'supervisor')
            ->where('users.status', '!=', 'deactivated')
            ->select(
                'users.user_id as id',
                DB::raw("CONCAT(user_profiles.first_name, ' ', user_profiles.last_name) as name"),
                'users.email as email'
            )
            ->distinct()
            ->get();

        return response()->json($supervisors);
    }

    public function getTitles(): JsonResponse
    {
        $titles = Title::where('is_active', true)->orderBy('id')->get(['id', 'name']);
        return response()->json($titles);
    }

    public function getSubsystems(): JsonResponse
    {
        $subsystems = DB::table('subsystems')
            ->join('systems', 'subsystems.system_id', '=', 'systems.id')
            ->where('subsystems.is_active', true)
            ->select(
                'subsystems.id',
                'subsystems.name',
                'systems.id as system_id',
                'systems.name as system_name'
            )
            ->get();
        return response()->json($subsystems);
    }
}