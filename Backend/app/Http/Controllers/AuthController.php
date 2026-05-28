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
     * Send OTP to the user's email address.
     * 
     * Business Logic:
     * - Validates the email format.
     * - If the user does not exist, checks if they have a valid pending invitation.
     * - Rejects cancelled, expired, or inactive invitations.
     * - Generates a 6-digit OTP and dispatches an email.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
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
            // Check invitation validity if an invitation record exists
            $userExists = User::where('email', $request->email)->exists();
            if (!$userExists) {
                $invitation = \App\Models\UserInvitation::where('email', $request->email)->first();

                if ($invitation) {
                    if ($invitation->status === 'cancelled') {
                        return response()->json(['error' => 'This invitation has been cancelled.'], 403);
                    }

                    if ($invitation->status === 'expired' || $invitation->expires_at->isPast()) {
                        if ($invitation->status !== 'expired') {
                            $invitation->update(['status' => 'expired']);
                        }
                        return response()->json(['error' => 'This invitation has expired.'], 403);
                    }

                    if ($invitation->status !== 'pending') {
                        return response()->json(['error' => 'This invitation is no longer active.'], 403);
                    }
                }
            }

            $ip = $request->ip() ?? '0.0.0.0';
            $otp = $this->otpService->send($request->email, $ip);

            // Testing: Log OTP to Laravel log
            Log::info("OTP for {$request->email}: {$otp}");
            
            // Log OTP to custom log.text for the user
            $logPath = storage_path('logs/log.text');
            $timestamp = now()->toDateTimeString();
            \Illuminate\Support\Facades\File::append($logPath, "[$timestamp] OTP GENERATED: $otp | EMAIL: {$request->email} | IP: {$ip}\n");

            Mail::to($request->email)->send(new OtpMail((string)$otp));

            return response()->json(['message' => 'OTP sent successfully.']);
        }
        catch (\Throwable $e) {
            Log::error('OTP Send Error: ' . $e->getMessage(), [
                'email' => $request->email,
                'trace' => $e->getTraceAsString()
            ]);

            $isRateLimit = str_contains($e->getMessage(), 'Too many requests') || str_contains($e->getMessage(), 'Please wait');
            $statusCode = $isRateLimit ? 429 : 500;

            return response()->json([
                'error' => 'Could not send OTP. Please try again later.',
                'debug' => config('app.debug') ? $e->getMessage() : null
            ], $statusCode);
        }
    }

    /**
     * Verify OTP and issue JWT tokens for authentication.
     * 
     * Business Logic:
     * - Validates OTP against the cached value via OtpService.
     * - If the user does not exist, checks for a valid invitation and registers them automatically.
     * - If registered via invitation, attaches the invited role and logs the acceptance.
     * - Checks if the user profile is blocked (due to retry limits or manual admin action).
     * - Issues short-lived access and refresh tokens.
     * 
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
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

        $ip = $request->ip() ?? '0.0.0.0';
        $isValid = $this->otpService->verify($request->email, $request->otp, $ip);

        if (!$isValid) {
            return response()->json(['error' => 'Invalid or expired OTP.'], 401);
        }

        $userExists = User::where('email', $request->email)->exists();
        if (!$userExists) {
            $invitation = \App\Models\UserInvitation::where('email', $request->email)->first();

            if ($invitation) {
                if ($invitation->status === 'cancelled') {
                    return response()->json(['error' => 'This invitation has been cancelled.'], 403);
                }

                if ($invitation->status === 'expired' || $invitation->expires_at->isPast()) {
                    if ($invitation->status !== 'expired') {
                        $invitation->update(['status' => 'expired']);
                    }
                    return response()->json(['error' => 'This invitation has expired.'], 403);
                }

                if ($invitation->status !== 'pending') {
                    return response()->json(['error' => 'This invitation is no longer active.'], 403);
                }
            }

            // Create the new user
            $user = User::create([
                'email' => $request->email,
                'status' => 'onboarding',
            ]);

            // Create user profile skeleton
            \Illuminate\Support\Facades\DB::table('user_profiles')->insert([
                'user_id' => $user->user_id,
                'first_name' => 'User',
                'last_name' => 'Member',
                'date_of_birth' => '2000-01-01',
                'created_at' => now(),
                'updated_at' => now()
            ]);

            // Attach role from invitation or default 'user'
            $roleSlug = $invitation ? ($invitation->role ?: 'user') : 'user';
            $roleRecord = \App\Models\Role::where('slug', $roleSlug)->first();
            if ($roleRecord) {
                $user->roles()->attach($roleRecord->id, ['is_active' => true]);
            }

            if ($invitation) {
                // Accept invitation
                $invitation->update([
                    'status' => 'accepted',
                    'invited_user_id' => $user->user_id,
                    'accepted_at' => now(),
                ]);

                // Log acceptance
                \App\Models\InvitationLog::create([
                    'invitation_id' => $invitation->id,
                    'action' => 'accepted',
                    'performed_by' => $user->user_id,
                    'remarks' => 'Invitation accepted via OTP verification.'
                ]);
            }
        } else {
            $user = User::where('email', $request->email)->first();
        }

        $user->load('roles');

        if ($user && $user->status === 'deactivated') {
            $superAdmin = \Illuminate\Support\Facades\DB::table('users as u')
                ->join('user_roles as ur', 'u.user_id', '=', 'ur.user_id')
                ->join('roles as r', 'ur.role_id', '=', 'r.id')
                ->where('r.slug', 'super_admin')
                ->first();
            $adminEmail = $superAdmin ? $superAdmin->email : 'admin@example.com';

            return response()->json([
                'error' => 'PROFILE_BLOCKED',
                'message' => "Your profile is restricted. To know more, contact the super admin at {$adminEmail}."
            ], 403);
        }

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

        if ($contact) {
            $continent = \App\Models\Continent::find($contact->continent_id);
            $country = \App\Models\Country::find($contact->country_id);
            $contact->continent_name = $continent ? $continent->name : null;
            $contact->country_name = $country ? $country->name : null;
        }

        $affiliation = \Illuminate\Support\Facades\DB::table('user_affilation as ua')
            ->leftJoin('institutes as i', 'ua.institute_id', '=', 'i.id')
            ->where('ua.user_id', $userId)
            ->select('ua.*', 'i.name as institute_name', 'i.code as institute_code')
            ->first();
            
        $supervisor = \Illuminate\Support\Facades\DB::table('user_supervisors')
            ->where('user_id', $userId)
            ->where('is_active', true)
            ->first();

        $application = \Illuminate\Support\Facades\DB::table('applications')
            ->where('user_id', $userId)
            ->orderByDesc('created_at')
            ->first();

        $canSetupSsh = false;
        if ($application) {
            $hasKey = \Illuminate\Support\Facades\DB::table('ssh_keys')
                ->where('user_id', $userId)
                ->where('status', 'active')
                ->exists();

            if (!$hasKey) {
                // Check if any approval step has computing services recommended
                $hasComputingRecommendation = \Illuminate\Support\Facades\DB::table('application_approvals as aa')
                    ->join('approval_services as asv', 'aa.id', '=', 'asv.approval_id')
                    ->join('services as s', 'asv.service_id', '=', 's.id')
                    ->where('aa.application_id', $application->id)
                    ->where('s.is_computing', true)
                    ->exists();

                $isPostApproval = in_array($application->status, ['approved', 'completed', 'approved_by_li_coordinator', 'provisioning_pending']);
                $isComputing = $application->computing_services || $hasComputingRecommendation;

                // Show SSH setup ONLY if computing is involved AND it's past LI-coordinator approval
                $canSetupSsh = $isComputing && $isPostApproval;
            }
        }

        return response()->json([
            'user'           => $user,
            'profile'        => $user->profile,
            'qualifications' => $qualifications,
            'contact'        => $contact,
            'affiliation'    => $affiliation,
            'roles'          => $roles,
            'permissions'    => $permissions,
            'can_setup_ssh'  => $canSetupSsh,
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
            'department'     => 'sometimes|string|max:255',
            'other_institute'=> 'nullable|string|max:255',
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

        // ── Affiliation info (Department & Other Institute) ─────────────────
        if ($request->has('department') || $request->has('other_institute')) {
            $affData = ['updated_at' => now()];
            if ($request->has('department')) $affData['department'] = $request->input('department');
            if ($request->has('other_institute')) $affData['other_institute'] = $request->input('other_institute');

            \Illuminate\Support\Facades\DB::table('user_affilation')
                ->where('user_id', $userId)
                ->update($affData);
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
            'graduation_year'       => 'required|digits:4|integer|min:' . (date('Y') - 70) . '|max:2100',
            'graduation_month'      => 'required|integer|min:1|max:12',
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

            $now = now();
            $is_active = ($request->graduation_year > $now->year) || ($request->graduation_year == $now->year && $request->graduation_month >= $now->month);

            // Insert the new qualification
            \Illuminate\Support\Facades\DB::table('user_qualification')->insert([
                'user_id'               => $userId,
                'highest_qualification' => $request->highest_qualification,
                'field_of_study'        => $request->field_of_study,
                'university'            => $request->university,
                'graduation_year'       => $request->graduation_year,
                'graduation_month'      => $request->graduation_month,
                'is_active'             => $is_active,
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

    /**
     * Get list of permission slugs for the authenticated user.
     * GET /api/auth/my-permissions [JWT required]
     */
    public function getMyPermissions(Request $request): \Illuminate\Http\JsonResponse
    {
        $userId = $request->auth_user_id;
        if (!$userId) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $permissions = \Illuminate\Support\Facades\DB::table('user_roles as ur')
            ->join('roles as r', 'ur.role_id', '=', 'r.id')
            ->join('roles_permissions as rp', 'r.id', '=', 'rp.role_id')
            ->join('permissions as p', 'rp.permission_id', '=', 'p.id')
            ->where('ur.user_id', $userId)
            ->where('ur.is_active', true)
            ->where('rp.is_active', true)
            ->pluck('p.slug')
            ->unique()
            ->values();

        return response()->json($permissions);
    }
}