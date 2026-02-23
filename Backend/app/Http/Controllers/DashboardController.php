<?php

namespace App\Http\Controllers;

use App\Models\System;
use App\Models\SubSystem;
use App\Models\Institute;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class DashboardController extends Controller
{
    /**
     * Get current authenticated user's full profile
     * (user + registration data + institute)
     */
    public function profile(): JsonResponse
    {
        $user = Auth::user();
        if (!$user) return response()->json(['message' => 'Unauthenticated'], 401);

        $user->load('registration', 'institute');

        return response()->json([
            'user'         => $user,
            'registration' => $user->registration,
            'institute'    => $user->institute,
        ]);
    }

    /**
     * Get all active systems (unique names across all institutes)
     */
    public function systems(): JsonResponse
    {
        $systems = System::where('is_active', true)
            ->with('institute:id,name,code')
            ->select('id', 'name', 'code', 'description', 'institute_id')
            ->orderBy('name')
            ->get();

        return response()->json($systems);
    }

    /**
     * Get institutes that have a specific system (by system name)
     */
    public function institutesBySystem(Request $request): JsonResponse
    {
        $request->validate(['system_name' => 'required|string']);

        $institutes = Institute::whereHas('systems', function ($q) use ($request) {
                $q->where('name', $request->system_name)->where('is_active', true);
            })
            ->where('is_active', true)
            ->select('id', 'name', 'code', 'city')
            ->orderBy('name')
            ->get();

        return response()->json($institutes);
    }

    /**
     * Get sub-systems for a specific system in a specific institute
     */
    public function subSystems(Request $request): JsonResponse
    {
        $request->validate([
            'system_name'  => 'required|string',
            'institute_id' => 'required|integer',
        ]);

        $system = System::where('name', $request->system_name)
            ->where('institute_id', $request->institute_id)
            ->where('is_active', true)
            ->first();

        if (!$system) {
            return response()->json(['message' => 'System not found for this institute'], 404);
        }

        $subSystems = $system->subSystems()
            ->where('is_active', true)
            ->select('id', 'name', 'code', 'description')
            ->orderBy('name')
            ->get();

        return response()->json($subSystems);
    }

    /**
     * Submit an access request
     */
    public function sendRequest(Request $request): JsonResponse
    {
        $request->validate([
            'system_name'   => 'required|string',
            'institute_id'  => 'required|integer',
            'sub_system_id' => 'required|integer',
            'time_period'   => 'required|string|in:1_month,3_months,6_months,1_year,permanent',
            'reason'        => 'nullable|string|max:500',
        ]);

        $user = Auth::user();
        if (!$user) return response()->json(['message' => 'Unauthenticated'], 401);

        // TODO: Store the request in a dedicated access_requests table
        // For now log and return success
        \Log::info('Access request submitted', [
            'user_id'       => $user->id,
            'system_name'   => $request->system_name,
            'institute_id'  => $request->institute_id,
            'sub_system_id' => $request->sub_system_id,
            'time_period'   => $request->time_period,
        ]);

        return response()->json([
            'message' => 'Access request submitted successfully. You will be notified once approved.',
        ]);
    }
}
