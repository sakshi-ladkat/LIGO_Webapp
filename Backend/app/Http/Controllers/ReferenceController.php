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
            // System Lead Join
            ->leftJoin('entity_assignments as ea_sys', function ($join) {
                $join->on('systems.id', '=', 'ea_sys.entity_id')
                    ->where('ea_sys.entity_type', 'system')
                    ->where('ea_sys.is_active', true);
            })
            ->leftJoin('user_profiles as up_sys', 'ea_sys.user_id', '=', 'up_sys.user_id')
            // Subsystem Lead Join
            ->leftJoin('entity_assignments as ea_sub', function ($join) {
                $join->on('subsystems.id', '=', 'ea_sub.entity_id')
                    ->where('ea_sub.entity_type', 'subsystem')
                    ->where('ea_sub.is_active', true);
            })
            ->leftJoin('user_profiles as up_sub', 'ea_sub.user_id', '=', 'up_sub.user_id')
            ->where('subsystems.is_active', true)
            ->select(
                'subsystems.id',
                'subsystems.name',
                'systems.id as system_id',
                'systems.name as system_name',
                \DB::raw("COALESCE(CONCAT(up_sys.first_name, ' ', up_sys.last_name), 'System Lead') as system_lead_name"),
                \DB::raw("COALESCE(CONCAT(up_sub.first_name, ' ', up_sub.last_name), 'Subsystem Lead') as subsystem_lead_name")
            )
            ->get();
        return response()->json($subsystems);
    }

    public function getDurations(): JsonResponse
    {
        $durations = DB::table('durations')
            ->where('is_active', true)
            ->orderBy('id')
            ->get(['id', 'name']);
        return response()->json($durations);
    }
}