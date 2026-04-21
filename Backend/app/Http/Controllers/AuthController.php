<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Contracts\OtpServiceInterface;
use App\Contracts\AuthServiceInterface;
use App\Mail\OtpMail;
use App\Models\User;
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
            return response()->json(['error' => $e->getMessage()], 429);
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
            return response()->json(['error' => $e->getMessage()], 401);
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
     * Get authenticated user with roles and permissions.
     * GET /api/auth/me  [JWT required]
     */
    public function me(Request $request)
    {
        $user = User::where('user_id', $request->auth_user_id)
            ->with(['roles.permissions', 'profile'])
            ->first();

        if (!$user) {
            return response()->json(['error' => 'User not found.'], 404);
        }

        $roles = $user->roles->map(fn($r) => [
        'id' => $r->id,
        'name' => $r->name,
        'slug' => $r->slug,
        'level' => $r->level,
        'description' => $r->description,
        ]);

        $permissions = $user->roles
            ->flatMap(fn($r) => $r->permissions->pluck('slug'))
            ->unique()
            ->values();

        return response()->json([
            'user' => $user,
            'profile' => $user->profile,
            'roles' => $roles,
            'permissions' => $permissions,
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
}