<?php

namespace App\Http\Controllers;

use App\Models\System;
use App\Models\SubSystem;
use App\Models\Institute;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use App\Models\Country;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Cache;
use App\Mail\ContactUpdateOtpMail;

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
                $registration->country = $country->name;
            }
        }

        // Load roles with system/subsystem context via a clean DB query
        $roles = \DB::table('roles')
            ->join('role_user', 'roles.id', '=', 'role_user.role_id')
            ->leftJoin('systems as sys', 'role_user.system_id', '=', 'sys.id')
            ->leftJoin('sub_systems as sub', 'role_user.sub_system_id', '=', 'sub.id')
            ->where('role_user.user_id', $user->id)
            ->select('roles.id', 'roles.name', 'sys.name as system_name', 'sub.name as sub_system_name')
            ->get();

        return response()->json([
            'user'            => $user,
            'registration'    => $registration,
            'institute'       => $user->institute,
            'institute_name'  => $user->institute_id == 18
                                  ? ($registration?->other_institute ?? 'Other')
                                  : ($user->institute?->name ?? ''),
            'roles'           => $roles,
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
            'status'        => 'pending',
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
            'prefix'              => 'nullable|string|max:50',
            'first_name'          => 'required|string|max:255',
            'middle_name'         => 'nullable|string|max:255',
            'last_name'           => 'required|string|max:255',
            'dob'                 => 'nullable|date|before:today',
            'office_country_code' => 'nullable|string|max:10',
            'office_city_code'    => 'nullable|string|max:20',
            'office_number'       => 'nullable|string|max:30',
            'address_line1'       => 'nullable|string|max:255',
            'address_line2'       => 'nullable|string|max:255',
            'address_line3'       => 'nullable|string|max:255',
            'city'                => 'nullable|string|max:255',
            'state'               => 'nullable|string|max:255',
            'postal_code'         => 'nullable|string|max:50',
            'country'             => 'nullable|string|max:255',
            'institute_id'        => 'nullable|integer|exists:institutes,id',
            'contact_otp_token'   => 'nullable|string',
        ]);

        $registration = $user->registration;
        if (!$registration) {
            return response()->json(['message' => 'Registration data not found.'], 404);
        }

        // Check if contact info fields are being updated
        $contactFields = [
            'office_country_code', 'office_city_code', 'office_number',
            'address_line1', 'address_line2', 'address_line3',
            'city', 'state', 'postal_code', 'country'
        ];
        
        $contactChanged = false;
        foreach ($contactFields as $field) {
            if ($request->has($field) && $request->input($field) !== $registration->{$field}) {
                $contactChanged = true;
                break;
            }
        }

        if ($contactChanged) {
            $token = $request->input('contact_otp_token');
            if (!$token || Cache::get("contact_verified_token_{$user->id}") !== $token) {
                return response()->json(['message' => 'Contact update requires OTP verification.'], 403);
            }
            // Clear token after use (optional, but good practice. or let it expire.)
            Cache::forget("contact_verified_token_{$user->id}");
        }

        if ($request->has('institute_id') && $request->institute_id != $user->institute_id) {
            $user->institute_id = $request->institute_id;
            $user->save();
        }

        $registration->update($request->only([
            'prefix', 'first_name', 'middle_name', 'last_name', 'dob',
            'office_country_code', 'office_city_code', 'office_number',
            'address_line1', 'address_line2', 'address_line3',
            'city', 'state', 'postal_code', 'country'
        ]));

        return response()->json([
            'message' => 'Profile updated successfully.',
            'registration' => $registration
        ]);
    }

    /**
     * Send OTP for contact update.
     */
    public function sendContactUpdateOtp(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) return response()->json(['message' => 'Unauthenticated'], 401);

        // Generate 6-digit OTP
        $otp = sprintf("%06d", mt_rand(1, 999999));
        
        // Store in cache for 10 minutes
        Cache::put("contact_update_otp_{$user->id}", $otp, now()->addMinutes(10));

        // Send Email
        try {
            Mail::to($user->email)->send(new ContactUpdateOtpMail($otp));
        } catch (\Exception $e) {
            \Log::error("Failed to send contact update OTP: " . $e->getMessage());
            return response()->json(['message' => 'Failed to send OTP email. Please try again later.'], 500);
        }

        return response()->json(['message' => 'OTP sent successfully.']);
    }

    /**
     * Verify OTP for contact update.
     */
    public function verifyContactUpdateOtp(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (!$user) return response()->json(['message' => 'Unauthenticated'], 401);

        $request->validate(['otp' => 'required|string|size:6']);
        
        $cachedOtp = Cache::get("contact_update_otp_{$user->id}");

        if (!$cachedOtp || $cachedOtp !== $request->otp) {
            return response()->json(['message' => 'Invalid or expired OTP.'], 400);
        }

        // Clear OTP
        Cache::forget("contact_update_otp_{$user->id}");

        // Generate a short-lived token to allow the actual profile update
        $token = bin2hex(random_bytes(16));
        Cache::put("contact_verified_token_{$user->id}", $token, now()->addMinutes(15));

        return response()->json([
            'message' => 'OTP verified successfully.',
            'contact_otp_token' => $token
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
            'degree_level'      => 'required|string',
            'degree_title'      => 'required|string',
            'specialization'    => 'nullable|string',
            'institute_name'    => 'required|string',
            'institute_country' => 'required|string',
            'start_date'        => 'required|date',
            'end_date'          => 'nullable|date|after_or_equal:start_date',
            'grading_system'    => 'required|string',
            'grade_value'       => 'required|string',
            'is_current'        => 'nullable|boolean',
            'is_active'         => 'nullable|boolean',
        ]);

        $education = $user->education()->create(array_merge(
            $request->only(['degree_level','degree_title','specialization','institute_name',
                            'institute_country','start_date','end_date','grading_system','grade_value']),
            ['is_current' => $request->boolean('is_current', false),
             'is_active'  => $request->boolean('is_active', true)]
        ));

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
            'degree_level'      => 'required|string',
            'degree_title'      => 'required|string',
            'specialization'    => 'nullable|string',
            'institute_name'    => 'required|string',
            'institute_country' => 'required|string',
            'start_date'        => 'required|date',
            'end_date'          => 'nullable|date|after_or_equal:start_date',
            'grading_system'    => 'required|string',
            'grade_value'       => 'required|string',
            'is_current'        => 'nullable|boolean',
            'is_active'         => 'nullable|boolean',
        ]);

        $education->update(array_merge(
            $request->only(['degree_level','degree_title','specialization','institute_name',
                            'institute_country','start_date','end_date','grading_system','grade_value']),
            ['is_current' => $request->boolean('is_current', false),
             'is_active'  => $request->boolean('is_active', true)]
        ));

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
            'current_affiliation'     => 'required|string',
            'affiliated_organization' => 'required|string',
            'country'                 => 'required|string',
            'position_role'           => 'required|string',
            'start_date'              => 'required|date',
            'end_date'                => 'nullable|date|after_or_equal:start_date',
            'is_active'               => 'nullable|boolean',
        ]);

        $affiliation = $user->affiliations()->create(array_merge(
            $request->only(['current_affiliation','affiliated_organization','country',
                            'position_role','start_date','end_date']),
            ['is_active' => $request->boolean('is_active', true)]
        ));

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

public function submitInstituteTransfer(Request $request): JsonResponse
    {
        $user = Auth::user();
        $request->validate([
            'institute_id' => 'required|integer|exists:institutes,id'
        ]);

        if ($user->institute_id == $request->institute_id) {
            return response()->json(['message' => 'You are already affiliated with this institute.'], 400);
        }

        // Check if there is already a pending request
        $existing = \App\Models\InstituteTransferRequest::where('user_id', $user->id)
            ->whereIn('status', ['pending_current_li', 'pending_target_li'])
            ->first();

        if ($existing) {
            return response()->json(['message' => 'You already have a pending institute transfer request.'], 400);
        }

        $transfer = \App\Models\InstituteTransferRequest::create([
            'user_id' => $user->id,
            'from_institute_id' => $user->institute_id,
            'to_institute_id' => $request->institute_id,
            'status' => 'pending_current_li'
        ]);

        return response()->json(['message' => 'Institute transfer request submitted successfully.', 'transfer' => $transfer]);
    }

    public function myInstituteTransfers(): JsonResponse
    {
        $user = Auth::user();
        $transfers = \App\Models\InstituteTransferRequest::where('user_id', $user->id)
            ->join('institutes as from_inst', 'institute_transfer_requests.from_institute_id', '=', 'from_inst.id', 'left')
            ->join('institutes as to_inst', 'institute_transfer_requests.to_institute_id', '=', 'to_inst.id')
            ->select('institute_transfer_requests.*', 'from_inst.name as from_institute_name', 'to_inst.name as to_institute_name')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($transfers);
    }
}
