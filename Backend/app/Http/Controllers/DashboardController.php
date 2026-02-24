<?php

namespace App\Http\Controllers;

use App\Models\System;
use App\Models\SubSystem;
use App\Models\Institute;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use App\Models\Country;

class DashboardController extends Controller
{
    /**
     * Get current authenticated user's full profile.
     * Resolves the country code → country name before returning.
     */
    public function profile(): JsonResponse
    {
        $user = Auth::user();
        if (!$user) return response()->json(['message' => 'Unauthenticated'], 401);

        $user->load('registration', 'institute');

        $registration = $user->registration;

        // Resolve country id → country name
        if ($registration && $registration->country) {
            $country = Country::where('id', $registration->country)
                              ->select('name')
                              ->first();
            if ($country) {
                // Override the raw code with the human-readable name
                $registration->country = $country->name;
            }
        }

        return response()->json([
            'user'         => $user,
            'registration' => $registration,
            'institute'    => $user->institute,
        ]);
    }

    /**
     * Get all active systems (unique by name, across all institutes).
     */
    public function systems(): JsonResponse
    {
        // Fetch distinct system names (a system may appear in multiple institutes)
        $systems = System::where('is_active', true)
            ->with('institutes:id,name,code')
            ->select('id', 'name', 'code', 'description')
            ->orderBy('name')
            ->get();

        return response()->json($systems);
    }

    /**
     * Get institutes that have a specific system (by system name).
     */
    public function institutesBySystem(Request $request): JsonResponse
    {
        $request->validate(['system_name' => 'required|string']);

        $institutes = Institute::whereHas('systems', function ($q) use ($request) {
                $q->where('systems.name', $request->system_name)
                  ->where('systems.is_active', true);
            })
            ->where('is_active', true)
            ->select('id', 'name', 'code', 'city')
            ->orderBy('name')
            ->get();

        return response()->json($institutes);
    }

    /**
     * Get sub-systems for a specific system in a specific institute.
     */
    public function subSystems(Request $request): JsonResponse
    {
        $request->validate([
            'system_name'  => 'required|string',
            'institute_id' => 'required|integer',
        ]);

        // Find the system that is linked to the given institute via the pivot
        $system = System::where('name', $request->system_name)
            ->where('is_active', true)
            ->whereHas('institutes', fn ($q) => $q->where('institutes.id', $request->institute_id))
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
     * Submit an access request.
     */
    public function sendRequest(Request $request): JsonResponse
    {
        $request->validate([
            'system_name'   => 'required|string',
            'institute_id'  => 'required|integer',
            'sub_system_id' => 'required|integer',
            'start_date'    => 'required|date',
            'end_date'      => 'required|date|after:start_date',
            'reason'        => 'nullable|string|max:500',
        ]);

        $start = \Carbon\Carbon::parse($request->start_date)->startOfDay();
        $end = \Carbon\Carbon::parse($request->end_date)->startOfDay();

        // Check if duration is at least 3 months
        if ($end->copy()->subMonths(3)->lt($start)) {
            return response()->json([
                'message' => 'The access duration cannot be less than 3 months.',
                'errors' => ['end_date' => ['Duration must be at least 3 months.']]
            ], 422);
        }

        // Check if duration is at most 1 year
        if ($end->copy()->subYears(1)->gt($start)) {
            return response()->json([
                'message' => 'The access duration cannot be more than 1 year.',
                'errors' => ['end_date' => ['Duration cannot exceed 1 year.']]
            ], 422);
        }

        $user = Auth::user();
        if (!$user) return response()->json(['message' => 'Unauthenticated'], 401);

        \Log::info('Access request submitted', [
            'user_id'       => $user->id,
            'system_name'   => $request->system_name,
            'institute_id'  => $request->institute_id,
            'sub_system_id' => $request->sub_system_id,
            'start_date'    => $request->start_date,
            'end_date'      => $request->end_date,
        ]);

        return response()->json([
            'message' => 'Access request submitted successfully. You will be notified once approved.',
        ]);
    }
}
