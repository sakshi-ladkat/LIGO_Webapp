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
            'services'      => 'nullable|string',
            'start_date'    => 'required|date',
            'end_date'      => 'required|date|after:start_date',
            'reason'        => 'nullable|string|max:500',
        ]);

        $start = \Carbon\Carbon::parse($request->start_date)->startOfDay();
        $end = \Carbon\Carbon::parse($request->end_date)->startOfDay();

        $user = Auth::user();
        if (!$user) return response()->json(['message' => 'Unauthenticated'], 401);

        $accessReq = \App\Models\AccessRequest::create([
            'user_id'       => $user->id,
            'system_name'   => $request->system_name,
            'institute_id'  => $request->institute_id,
            'services'      => $request->services,
            'start_date'    => $request->start_date,
            'end_date'      => $request->end_date,
            'status'        => 'Pending User Request',
        ]);

        return response()->json([
            'message' => 'Access request submitted successfully. You will be notified once approved.',
        ]);
    }

    /**
     * Get user's access requests.
     */
    public function myRequests(): JsonResponse
    {
        $user = Auth::user();
        if (!$user) return response()->json(['message' => 'Unauthenticated'], 401);

        $requests = \App\Models\AccessRequest::where('user_id', $user->id)
            ->with('institute')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($requests->map(fn($r) => [
            'id'          => $r->id,
            'system_name' => $r->system_name,
            'institute'   => $r->institute?->name,
            'services'    => $r->services,
            'start_date'  => $r->start_date,
            'end_date'    => $r->end_date,
            'status'      => $r->status,
            'created_at'  => $r->created_at?->format('Y-m-d')
        ]));
    }

    /**
     * Update user profile information.
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) return response()->json(['message' => 'Unauthenticated'], 401);

        $request->validate([
            'prefix'        => 'nullable|string|max:50',
            'first_name'    => 'required|string|max:255',
            'middle_name'   => 'nullable|string|max:255',
            'last_name'     => 'required|string|max:255',
            'address_line1' => 'nullable|string|max:255',
            'address_line2' => 'nullable|string|max:255',
            'address_line3' => 'nullable|string|max:255',
            'city'          => 'nullable|string|max:255',
            'state'         => 'nullable|string|max:255',
            'postal_code'   => 'nullable|string|max:50',
            'country'       => 'nullable|string|max:255',
        ]);

        $registration = $user->registration;
        if (!$registration) {
            return response()->json(['message' => 'Registration data not found.'], 404);
        }

        $registration->update($request->only([
            'prefix', 'first_name', 'middle_name', 'last_name',
            'address_line1', 'address_line2', 'address_line3',
            'city', 'state', 'postal_code', 'country'
        ]));

        return response()->json([
            'message' => 'Profile updated successfully.',
            'registration' => $registration
        ]);
    }

    /**
     * Get user education records.
     */
    public function getEducation(): JsonResponse
    {
        $user = Auth::user();
        return response()->json($user->education);
    }

    /**
     * Add a user education record.
     */
    public function addEducation(Request $request): JsonResponse
    {
        $user = Auth::user();

        $request->validate([
            'degree_level' => 'required|string',
            'degree_title' => 'required|string',
            'specialization' => 'nullable|string',
            'institute_name' => 'required|string',
            'institute_country' => 'required|string',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'grading_system' => 'required|string',
            'grade_value' => 'required|string',
            'is_current' => 'nullable|boolean'
        ]);

        $education = $user->education()->create($request->all());

        return response()->json(['message' => 'Education details added.', 'education' => $education]);
    }

    /**
     * Remove a user education record.
     */
    public function removeEducation($id): JsonResponse
    {
        $user = Auth::user();
        $education = $user->education()->find($id);

        if (!$education) {
            return response()->json(['message' => 'Education detail not found.'], 404);
        }

        $education->delete();

        return response()->json(['message' => 'Education detail removed.']);
    }

    /**
     * Update a user education record.
     */
    public function updateEducation(Request $request, $id): JsonResponse
    {
        $user = Auth::user();
        $education = $user->education()->find($id);

        if (!$education) {
            return response()->json(['message' => 'Education detail not found.'], 404);
        }

        $request->validate([
            'degree_level' => 'required|string',
            'degree_title' => 'required|string',
            'specialization' => 'nullable|string',
            'institute_name' => 'required|string',
            'institute_country' => 'required|string',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'grading_system' => 'required|string',
            'grade_value' => 'required|string',
            'is_current' => 'nullable|boolean'
        ]);

        $education->update($request->all());

        return response()->json(['message' => 'Education details updated.', 'education' => $education]);
    }

    /**
     * Get user affiliations.
     */
    public function getAffiliations(): JsonResponse
    {
        $user = Auth::user();
        return response()->json($user->affiliations);
    }

    /**
     * Add user affiliation.
     */
    public function addAffiliation(Request $request): JsonResponse
    {
        $user = Auth::user();

        $request->validate([
            'current_affiliation' => 'required|string',
            'affiliated_organization' => 'required|string',
            'country' => 'required|string',
            'position_role' => 'required|string',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date'
        ]);

        $affiliation = $user->affiliations()->create($request->all());

        return response()->json(['message' => 'Affiliation added.', 'affiliation' => $affiliation]);
    }

    /**
     * Remove user affiliation.
     */
    public function removeAffiliation($id): JsonResponse
    {
        $user = Auth::user();
        $affiliation = $user->affiliations()->find($id);

        if (!$affiliation) {
            return response()->json(['message' => 'Affiliation detail not found.'], 404);
        }

        $affiliation->delete();

        return response()->json(['message' => 'Affiliation detail removed.']);
    }

    /**
     * Update user affiliation.
     */
    public function updateAffiliation(Request $request, $id): JsonResponse
    {
        $user = Auth::user();
        $affiliation = $user->affiliations()->find($id);

        if (!$affiliation) {
            return response()->json(['message' => 'Affiliation detail not found.'], 404);
        }

        $request->validate([
            'current_affiliation' => 'required|string',
            'affiliated_organization' => 'required|string',
            'country' => 'required|string',
            'position_role' => 'required|string',
            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date'
        ]);

        $affiliation->update($request->all());

        return response()->json(['message' => 'Affiliation updated.', 'affiliation' => $affiliation]);
    }
}
