<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Contracts\OtpServiceInterface;
use App\Contracts\AuthServiceInterface;
use App\Mail\OtpMail;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    public function __construct(
        private OtpServiceInterface $otpService,
        private AuthServiceInterface $authService
        )
    {
    }

    /**
     * Send OTP to email.
     * POST /api/auth/otp/send
     */
    public function sendOtp(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $otp = $this->otpService->send($request->email, $request->ip());

            Mail::to($request->email)->send(new OtpMail((string)$otp));

            return response()->json(['message' => 'OTP sent successfully.']);
        }
        catch (\Exception $e) {
            Log::error('OTP Send Error: ' . $e->getMessage(), ['email' => $request->email]);
            return response()->json(['error' => 'Could not send OTP. Please try again later.'], 429);
        }
    }

    /**
     * Verify OTP → create/fetch user → issue token pair.
     * POST /api/auth/otp/verify
     */
    public function verifyOtp(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'otp' => 'required|string|size:6',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $isValid = $this->otpService->verify($request->email, $request->otp, $request->ip());

        if (!$isValid) {
            return response()->json(['error' => 'Invalid or expired OTP.'], 401);
        }

        // Find or create user
        $user = User::firstOrCreate(
        ['email' => $request->email],
        ['status' => 'onboarding']
        );

        $tokens = $this->authService->issueTokens($user, $request);

        return response()->json([
            'message' => 'Authenticated successfully.',
            'user' => $user,
            ...$tokens,
        ]);
    }

    /**
     * Rotate refresh token → issue new token pair.
     * POST /api/auth/refresh
     */
    public function refresh(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'refresh_token' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        try {
            $tokens = $this->authService->refresh($request->refresh_token, $request);

            return response()->json([
                'message' => 'Token refreshed successfully.',
                ...$tokens,
            ]);
        }
        catch (\Exception $e) {
            Log::error('Token Refresh Error: ' . $e->getMessage());
            return response()->json(['error' => 'Session could not be refreshed. Please log in again.'], 401);
        }
    }

    /**
     * Revoke refresh token (logout).
     * POST /api/auth/logout  [JWT required]
     */
    public function logout(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'refresh_token' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $this->authService->logout($request->refresh_token);

        return response()->json(['message' => 'Logged out successfully.']);
    }

    /**
     * Get authenticated user with roles, permissions, and all profile sub-tables.
     * GET /api/auth/me  [JWT required]
     */
    public function me(Request $request)
    {
        $userId = $request->auth_user_id;

        $user = User::where('user_id', $userId)
            ->with(['roles.permissions', 'profile'])
            ->first();

        if (!$user) {
            return response()->json(['error' => 'User not found.'], 404);
        }

        $roles = $user->roles->map(fn($r) => [
            'id'          => $r->id,
            'name'        => $r->name,
            'slug'        => $r->slug,
            'level'       => $r->level,
            'description' => $r->description,
        ]);

        $permissions = $user->roles
            ->flatMap(fn($r) => $r->permissions->pluck('slug'))
            ->unique()
            ->values();

        // Return ALL qualifications so the frontend can show history
        $qualifications = \Illuminate\Support\Facades\DB::table('user_qualification')
            ->where('user_id', $userId)
            ->orderByDesc('is_active')
            ->orderByDesc('created_at')
            ->get();

        $contact = \Illuminate\Support\Facades\DB::table('user_contacts')
            ->where('user_id', $userId)->first();

        return response()->json([
            'user'           => $user,
            'profile'        => $user->profile,
            'qualifications' => $qualifications,   // array, active first
            'contact'        => $contact,
            'roles'          => $roles,
            'permissions'    => $permissions,
        ]);
    }

    /**
     * Update authenticated user's own profile.
     * PATCH /api/auth/me  [JWT required]
     */
    public function updateProfile(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'sometimes|email|unique:users,email,' . $request->auth_user_id . ',user_id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = User::where('user_id', $request->auth_user_id)->first();

        if (!$user) {
            return response()->json(['error' => 'User not found.'], 404);
        }

        $user->update($request->only(['email']));

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => $user->fresh(),
        ]);
    }

    /**
     * Update authenticated user's personal and contact profile details.
     * PATCH /api/auth/profile  [JWT required]
     *
     * Qualification updates are NOT handled here — use POST /api/auth/qualification
     * to add a new qualification entry (history-preserving).
     */
    public function updateFullProfile(Request $request): \Illuminate\Http\JsonResponse
    {
        $userId = $request->auth_user_id;

        $validator = Validator::make($request->all(), [
            // Personal
            'title'          => 'sometimes|string|max:50',
            'first_name'     => 'sometimes|string|max:100',
            'middle_name'    => 'nullable|string|max:100',
            'last_name'      => 'sometimes|string|max:100',
            'date_of_birth'  => 'nullable|date',
            'gender'         => 'nullable|in:male,female,other,prefer-not-to-say',
            // Contact
            'country_name'   => 'sometimes|string|max:100',
            'city'           => 'sometimes|string|max:100',
            'state'          => 'sometimes|string|max:100',
            'postal_code'    => 'sometimes|string|max:20',
            'phone_number'   => 'sometimes|string|max:30',
            'address_line_1' => 'sometimes|string|max:255',
            'address_line_2' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // ── Personal info ──────────────────────────────────────────────────
        $personalData = $request->only(['title','first_name','middle_name','last_name','date_of_birth','gender']);
        if (!empty($personalData)) {
            \Illuminate\Support\Facades\DB::table('user_profiles')
                ->where('user_id', $userId)
                ->update(array_merge($personalData, ['updated_at' => now()]));
        }

        // ── Contact info ───────────────────────────────────────────────────
        $contactData = $request->only(['country_name','city','state','postal_code','phone_number','address_line_1','address_line_2']);
        if (!empty($contactData)) {
            \Illuminate\Support\Facades\DB::table('user_contacts')
                ->where('user_id', $userId)
                ->update(array_merge($contactData, ['updated_at' => now()]));
        }

        return response()->json(['message' => 'Profile updated successfully.']);
    }

    /**
     * Add a new qualification entry for the authenticated user.
     * POST /api/auth/qualification  [JWT required]
     *
     * Any existing active qualification rows are marked is_active = false
     * (history preserved). The new row is inserted with is_active = true.
     */
    public function addQualification(Request $request): \Illuminate\Http\JsonResponse
    {
        $userId = $request->auth_user_id;

        $validator = Validator::make($request->all(), [
            'highest_qualification' => 'required|string|max:150',
            'field_of_study'        => 'required|string|max:150',
            'university'            => 'required|string|max:200',
            'graduation_year'       => 'required|digits:4|integer|min:1900|max:2099',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        \Illuminate\Support\Facades\DB::beginTransaction();
        try {
            // Mark all existing qualifications for this user as inactive (history)
            \Illuminate\Support\Facades\DB::table('user_qualification')
                ->where('user_id', $userId)
                ->update(['is_active' => false, 'updated_at' => now()]);

            // Insert the new active qualification
            \Illuminate\Support\Facades\DB::table('user_qualification')->insert([
                'user_id'               => $userId,
                'highest_qualification' => $request->highest_qualification,
                'field_of_study'        => $request->field_of_study,
                'university'            => $request->university,
                'graduation_year'       => $request->graduation_year,
                'is_active'             => true,
                'created_at'            => now(),
                'updated_at'            => now(),
            ]);

            \Illuminate\Support\Facades\DB::commit();

            // Return updated list
            $qualifications = \Illuminate\Support\Facades\DB::table('user_qualification')
                ->where('user_id', $userId)
                ->orderByDesc('is_active')
                ->orderByDesc('created_at')
                ->get();

            return response()->json([
                'message'        => 'Qualification added successfully.',
                'qualifications' => $qualifications,
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\DB::rollBack();
            Log::error('Qualification Add Error: ' . $e->getMessage(), ['user_id' => $userId]);
            return response()->json(['error' => 'Failed to add qualification. Your session might be stale - please try re-logging.'], 500);
        }
    }
}