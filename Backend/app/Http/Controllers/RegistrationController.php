<?php

namespace App\Http\Controllers;


use App\Models\RegistrationData;
use App\Models\User;
use App\Mail\SetPasswordMail;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Illuminate\Support\Facades\Password;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class RegistrationController extends Controller
{
    /**
     * Send email verification link
     */
    public function sendVerificationLink(Request $request): JsonResponse
    {
        // Rate limiting: max 50 requests per minute per IP+email
        $key = 'verification:' . $request->ip() . ':' . $request->input('email');
        
        if (\Illuminate\Support\Facades\RateLimiter::tooManyAttempts($key, 50)) {
            return response()->json([
                'message' => 'Too many verification requests. Please try again later.'
            ], 429);
        }

        \Illuminate\Support\Facades\RateLimiter::hit($key, 60); // 60 seconds decay

        $request->validate([
            'email' => 'required|email|max:255'
        ]);

        $email = $request->email;

        // Check if email already exists in users table
        if (User::where('email', $email)->exists()) {
            return response()->json([
                'message' => 'Email is already registered.'
            ], 409);
        }

        // Check if email already has a pending registration
        $existingRegistration = RegistrationData::where('email', $email)
            ->whereIn('status', ['email_verified', 'password_set'])
            ->first();

        if ($existingRegistration) {
            return response()->json([
                'message' => 'Email already has a pending registration.'
            ], 409);
        }

        // Generate verification token (64 characters for enhanced security)
        $token = Str::random(64);
        $hashedToken = Hash::make($token);

        // Store in cache (15 minutes)
        $cacheKey = 'email_verification:' . $email;
        Cache::put($cacheKey, [
            'email' => $email,
            'token' => $hashedToken,
            'status' => 'unverified',
            'created_at' => now()->toDateTimeString(),
            'expires_at' => now()->addMinutes(15)->toDateTimeString()
        ], now()->addMinutes(15));

        // Generate verification link
        $verificationLink = url('/api/registration/verify-email?token=' . $token . '&email=' . urlencode($email));

        \Log::info('Generated Verification Link: ' . $verificationLink);

        // Send email
        try {
            Mail::to($email)->send(new \App\Mail\VerificationMail($verificationLink));
            
            // Log successful verification email send for security audit
            \Log::info('Verification email sent', [
                'email' => $email,
                'ip' => $request->ip(),
                'timestamp' => now()->toDateTimeString()
            ]);
            
            return response()->json([
                'message' => 'Verification link sent successfully! Please check your email.',
                'email' => $email
            ]);
        } catch (\Exception $e) {
            \Log::error('Verification email failed: ' . $e->getMessage(), [
                'email' => $email,
                'ip' => $request->ip()
            ]);
            
            return response()->json([
                'message' => 'Failed to send verification email. Please try again.'
            ], 500);
        }
    }

    /**
     * Resend verification link (Smart dispatch)
     */
    public function resendVerificationLink(Request $request): JsonResponse
    {
        // Rate limiting: max 10 resend requests per 10 minutes per IP+email
        $key = 'resend-verification:' . $request->ip() . ':' . $request->input('email');
        
        if (\Illuminate\Support\Facades\RateLimiter::tooManyAttempts($key, 10)) {
            return response()->json([
                'message' => 'Too many resend requests. Please try again in 10 minutes.'
            ], 429);
        }

        \Illuminate\Support\Facades\RateLimiter::hit($key, 600); // 600 seconds (10 minutes) decay

        $request->validate([
            'email' => 'required|email|max:255'
        ]);

        $email = $request->email;

        // Check if user account already exists
        if (User::where('email', $email)->exists()) {
            // Don't reveal that account exists for security
            return response()->json([
                'message' => 'If this email is registered, a verification link will be sent.'
            ], 200);
        }

        // Check for pending registration data
        $registration = RegistrationData::where('email', $email)->first();

        if ($registration && $registration->status === 'email_verified') {
            // Resend Password Setup Link
            return $this->resendPasswordSetupLink($email, $registration);
        } elseif ($registration && $registration->status === 'completed') {
             return response()->json([
                'message' => 'Registration completed. Please login.'
            ], 409);
        }

        // Resend Initial Email Verification Link
        return $this->resendEmailVerificationLink($email);
    }

    /**
     * Verify email from link
     */
    public function verifyEmail(Request $request)
    {
        $token = $request->query('token');
        $email = $request->query('email');

        \Log::info("Email verified successfully: $email");
        
        // Get frontend URL from config
        $frontendUrl = config('frontend.url');
        $frontendRoute = config('frontend.routes.registration');
        
        // Parse the route to separate base path and hash
        // Expected format: /index.html#/multi-step-register
        $parts = explode('#', $frontendRoute);
        $basePath = $parts[0] ?? '/index.html';
        $hashPath = $parts[1] ?? '/multi-step-register';

        if (!$email || !$token) {
            $redirectUrl = $frontendUrl . $basePath . '#' . $hashPath . '?error=invalid';
            return redirect($redirectUrl);
        }

        $cacheKey = 'email_verification:' . $email;
        $verificationData = Cache::get($cacheKey);

        if (!$verificationData) {
            $redirectUrl = $frontendUrl . $basePath . '#' . $hashPath . '?error=expired';
            return redirect($redirectUrl);
        }

        if ($verificationData['status'] === 'verified') {
            $redirectUrl = $frontendUrl . $basePath . '#' . $hashPath . '?token=' . $verificationData['token'] . '&email=' . urlencode($email) . '&message=already_verified';
            return redirect($redirectUrl);
        }

        if (now()->isAfter(Carbon::parse($verificationData['expires_at']))) {
            Cache::forget($cacheKey);
            $redirectUrl = $frontendUrl . $basePath . '#' . $hashPath . '?error=expired';
            return redirect($redirectUrl);
        }

        if (!Hash::check($token, $verificationData['token'])) {
            $redirectUrl = $frontendUrl . $basePath . '#' . $hashPath . '?error=invalid';
            return redirect($redirectUrl);
        }

        // Generate session token for registration
        $sessionToken = Str::random(64);

        // Update cache with verified status
        Cache::put($cacheKey, [
            'email' => $email,
            'token' => $sessionToken,
            'status' => 'verified',
            'verified_at' => now()->toDateTimeString(),
            'expires_at' => now()->addHours(24)->toDateTimeString()
        ], now()->addHours(24));
        
        \Log::info("User with email {$email} has been successfully verified.");

        // Redirect to registration form with token in hash fragment
        // Format: http://127.0.0.1:5503/index.html#/multi-step-register?token=...&email=...
        $redirectUrl = $frontendUrl . $basePath . '#' . $hashPath . '?token=' . $sessionToken . '&email=' . urlencode($email);
        
        \Log::info('Email verification redirect URL: ' . $redirectUrl);
        
        return redirect($redirectUrl);
    }

    /**
     * Save registration data (multi-step)
     */
    /**
     * Save registration data (multi-step)
     */
    public function saveRegistrationData(Request $request): JsonResponse
    {
        // Validation
        $request->validate([
            'token' => 'required|string',
            'email' => 'required|email',
            'institute_id' => 'required|exists:institutes,id',
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'address_line1' => 'required|string|max:255',
            'city' => 'required|string|max:255',
            'state' => 'required|string|max:255',
            'postal_code' => 'required|string|max:20',
            'continent' => 'required|string', // Assuming ID or name
            'country' => 'required|string',   // Assuming ID or name
            'office_country_code' => 'required|string|max:5',
            'office_number' => 'required|string|max:20',
        ]);

        // Verify token
        $cacheKey = 'email_verification:' . $request->email;
        $verificationData = Cache::get($cacheKey);

        if (!$verificationData || $verificationData['status'] !== 'verified' || $verificationData['token'] !== $request->token) {
            return response()->json([
                'message' => 'Invalid or expired verification token.'
            ], 403);
        }

        // Check if email already registered
        if (User::where('email', $request->email)->exists()) {
            return response()->json([
                'message' => 'Email is already registered.'
            ], 409);
        }

        // Create or update registration data
        $registrationData = RegistrationData::updateOrCreate(
            ['email' => $request->email],
            [
                'institute_id' => $request->institute_id,
                'first_name' => $request->first_name,
                'middle_name' => $request->middle_name,
                'last_name' => $request->last_name,
                'suffix' => $request->suffix,
                'address_line1' => $request->address_line1,
                'address_line2' => $request->address_line2,
                'address_line3' => $request->address_line3,
                'city' => $request->city,
                'state' => $request->state,
                'postal_code' => $request->postal_code,
                'continent' => $request->continent,
                'country' => $request->country,
                'office_country_code' => $request->office_country_code,
                'office_city_code' => $request->office_city_code,
                'office_number' => $request->office_number,
                'fax_number' => $request->fax_number,
                'status' => 'email_verified',
                'email_verified_at' => now(),
            ]
        );

        // Generate password setup token
        $passwordToken = Str::random(64);
        $hashedPasswordToken = Hash::make($passwordToken);

        // Store password setup token in cache (24 hours)
        $passwordCacheKey = 'password_setup:' . $request->email;
        Cache::put($passwordCacheKey, [
            'email' => $request->email,
            'token' => $hashedPasswordToken,
            'registration_id' => $registrationData->id,
            'expires_at' => now()->addHours(24)->toDateTimeString()
        ], now()->addHours(24));

        // Send password setup email
        $passwordSetupLink = url('/api/registration/setup-password?token=' . $passwordToken . '&email=' . urlencode($request->email));

        // LOG LINK FOR DEBUGGING
        \Log::info('PASSWORD SETUP LINK (NEW REGISTRATION): ' . $passwordSetupLink);

        try {
            Mail::to($request->email)->send(new SetPasswordMail($passwordSetupLink, $registrationData->full_name));
            
            // Clear verification cache
            Cache::forget($cacheKey);

            return response()->json([
                'message' => 'Registration successful! Please check your email to set your password.',
                'registration_id' => $registrationData->id
            ]);
        } catch (\Exception $e) {
            \Log::error('Password setup email failed: ' . $e->getMessage());
            
            return response()->json([
                'message' => 'Registration saved but failed to send password setup email. Please contact support.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Verify password setup token and show password form
     */
    public function setupPasswordPage(Request $request)
    {
        $email = $request->query('email');
        $token = $request->query('token');

        if (!$email || !$token) {
            return redirect()->route('password.setup', ['error' => 'invalid']);
        }

        // Validate token before redirecting (optional but good for UX)
        // Or simply pass params to the web route and let it validate
        return redirect()->route('password.setup', ['token' => $token, 'email' => $email]);
    }

    /**
     * Set password and create user account
     */
    public function setPassword(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'token' => 'required',
            'password' => 'required|min:8|confirmed',
        ]);

        $cacheKey = 'password_setup:' . $request->email;
        $setupData = Cache::get($cacheKey);

        if (!$setupData || !Hash::check($request->token, $setupData['token'])) {
            return response()->json([
                'message' => 'Invalid or expired password setup token.'
            ], 403);
        }

        if (now()->isAfter(Carbon::parse($setupData['expires_at']))) {
            Cache::forget($cacheKey);
            return response()->json([
                'message' => 'Password setup token has expired.'
            ], 403);
        }

        // Get registration data
        $registrationData = RegistrationData::find($setupData['registration_id']);

        if (!$registrationData) {
            return response()->json([
                'message' => 'Registration data not found.'
            ], 404);
        }

        // Check if user already exists
        if (User::where('email', $request->email)->exists()) {
            return response()->json([
                'message' => 'User account already exists. Please login.'
            ], 409);
        }

        // Generate username
        $baseUsername = strtolower(explode('@', $request->email)[0]);
        $username = $baseUsername;
        $count = 1;

        while (User::where('username', $username)->exists()) {
            $username = $baseUsername . $count++;
        }

        // Create user account
        $user = User::create([
            'email' => $request->email,
            'username' => $username,
            'password' => Hash::make($request->password),
            'institute_id' => $registrationData->institute_id,
            'email_verified_at' => now(),
        ]);

        // Update registration data
        $registrationData->update([
            'user_id' => $user->id,
            'status' => 'completed',
            'password_set_at' => now(),
        ]);

        // Create user profile from registration data
        $user->profile()->create([
            'first_name' => $registrationData->first_name,
            'middle_name' => $registrationData->middle_name,
            'last_name' => $registrationData->last_name,
            'address_line1' => $registrationData->address_line1,
            'address_line2' => $registrationData->address_line2,
            'address_line3' => $registrationData->address_line3,
            'city' => $registrationData->city,
            'state' => $registrationData->state,
            'postal_code' => $registrationData->postal_code,
            'country' => $registrationData->country,
            'mobile_number' => $registrationData->office_number,
            'country_code' => $registrationData->office_country_code,
        ]);

        // Clear cache
        Cache::forget($cacheKey);

        return response()->json([
            'message' => 'Password set successfully! You can now login.',
            'user_id' => $user->id,
            'username' => $username
        ]);
    }

    // Unified Web Routes for Blade View
    public function showPasswordForm(Request $request)
    {
        $mode = $request->route('mode', 'setup');
        $isReset = ($mode === 'reset');
        
        return view('auth.passwords.setPassword', [
            'token' => $request->token,
            'email' => $request->email,
            'isReset' => $isReset
        ]);
    }

    public function processPassword(Request $request) 
    {
        $mode = $request->route('mode', 'setup');

        $request->validate([
            'email' => 'required|email',
            'token' => 'required',
            'password' => 'required|min:8|confirmed',
        ]);

        if ($mode === 'setup') {
            return $this->processSetupPassword($request);
        } else {
            return $this->processResetPassword($request);
        }
    }

    private function processSetupPassword(Request $request)
    {
        $cacheKey = 'password_setup:' . $request->email;
        $setupData = Cache::get($cacheKey);

        if (!$setupData || !Hash::check($request->token, $setupData['token'])) {
             return back()->with('error', 'Invalid or expired password setup token.');
        }
        
        $registrationData = RegistrationData::find($setupData['registration_id']);
        if (!$registrationData) return back()->with('error', 'Registration data not found.');
        
        if (User::where('email', $request->email)->exists()) {
             return redirect(config('frontend.url') . config('frontend.routes.login'))->with('message', 'User already exists. Please login.');
        }

        // Generate username
        $baseUsername = strtolower(explode('@', $request->email)[0]);
        $username = $baseUsername;
        $count = 1;
        while (User::where('username', $username)->exists()) $username = $baseUsername . $count++;

        // Create User
        $user = User::create([
            'email' => $request->email,
            'username' => $username,
            'password' => Hash::make($request->password),
            'institute_id' => $registrationData->institute_id,
            'email_verified_at' => now(),
        ]);

        $registrationData->update(['user_id' => $user->id, 'status' => 'completed', 'password_set_at' => now()]);
        
        // Create Profile
        $user->profile()->create([
            'first_name' => $registrationData->first_name,
            'middle_name' => $registrationData->middle_name,
            'last_name' => $registrationData->last_name,
            'address_line1' => $registrationData->address_line1,
            'address_line2' => $registrationData->address_line2,
            'address_line3' => $registrationData->address_line3,
            'city' => $registrationData->city,
            'state' => $registrationData->state,
            'postal_code' => $registrationData->postal_code,
            'country' => $registrationData->country,
            'mobile_number' => $registrationData->office_number,
            'country_code' => $registrationData->office_country_code,
        ]);
        
        Cache::forget($cacheKey);

        // Auto Login? Or just redirect
        // Auth::login($user); 
        // Returning token? Not possible easily via redirect.
        
        // Redirect to Frontend Login with Success
        return redirect(config('frontend.url') . config('frontend.routes.login') . '?message=setup_complete');
    }

    private function processResetPassword(Request $request)
    {
        $status = Password::attempt(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function ($user, $password) {
                $user->forceFill([
                    'password' => Hash::make($password)
                ])->setRememberToken(Str::random(60));
                $user->save();
                event(new PasswordReset($user));
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return redirect(config('frontend.url') . config('frontend.routes.login') . '?message=reset_complete');
        }

        return back()->with('error', __($status));
    }

    // Private helper methods

    private function resendPasswordSetupLink(string $email, RegistrationData $registration): JsonResponse
    {
        $passwordToken = Str::random(64);
        $hashedPasswordToken = Hash::make($passwordToken);
        
        $passwordCacheKey = 'password_setup:' . $email;
        Cache::put($passwordCacheKey, [
            'email' => $email,
            'token' => $hashedPasswordToken,
            'registration_id' => $registration->id,
            'expires_at' => now()->addHours(24)->toDateTimeString()
        ], now()->addHours(24));
        
        $passwordSetupLink = url('/api/registration/setup-password?token=' . $passwordToken . '&email=' . urlencode($email));
        
        // LOG LINK FOR DEBUGGING
        \Log::info('PASSWORD SETUP LINK (RESEND): ' . $passwordSetupLink);

        try {
            Mail::to($email)->send(new SetPasswordMail($passwordSetupLink, $registration->full_name));
            return response()->json([
                'message' => 'Password setup link resent successfully! Please check your email.',
                'email' => $email
            ]);
        } catch (\Exception $e) {
            \Log::error('Resend password link failed: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to send email. Please try again later.'
            ], 500);
        }
    }

    private function resendEmailVerificationLink(string $email): JsonResponse
    {
        $token = Str::random(64);
        $hashedToken = Hash::make($token);

        $cacheKey = 'email_verification:' . $email;
        Cache::put($cacheKey, [
            'email' => $email,
            'token' => $hashedToken,
            'status' => 'unverified',
            'created_at' => now()->toDateTimeString(),
            'expires_at' => now()->addMinutes(15)->toDateTimeString()
        ], now()->addMinutes(15));

        $verificationLink = url('/api/registration/verify-email?token=' . $token . '&email=' . urlencode($email));

        try {
            Mail::to($email)->send(new \App\Mail\VerificationMail($verificationLink));
            
            return response()->json([
                'message' => 'Verification link resent successfully! Please check your email.',
                'email' => $email
            ]);
        } catch (\Exception $e) {
            \Log::error('Resend verification email failed: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to send verification email.'
            ], 500);
        }
    }


    /**
     * Save draft to Redis
     */
    public function saveDraft(Request $request): JsonResponse
    {
        Log::info('Draft save request received', ['email' => $request->email]);

        try {
            $request->validate([
                'email' => 'required|email'
            ]);

            $email = $request->email;
            $cacheKey = 'registration_draft:' . $email;

            // Get existing draft to merge if needed, or start fresh
            $existingDraft = Cache::get($cacheKey, []);
            
            // Merge request data with existing draft
            // We exclude 'email' from the merge to avoid redundancy, but keep it in the key
            $data = array_merge($existingDraft, $request->except(['email']));
            
            // Ensure email is always part of the data
            $data['email'] = $email;

            // Store in Redis for 24 hours
            Cache::put($cacheKey, $data, now()->addHours(24));

            Log::info('Draft saved successfully', ['email' => $email]);

            return response()->json([
                'message' => 'Draft saved successfully',
                'data' => $data
            ]);
        } catch (\Exception $e) {
            Log::error('Error saving draft', [
                'email' => $request->email ?? 'unknown',
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['message' => 'Failed to save draft'], 500);
        }
    }

    /**
     * Get draft from Redis
     */
    public function getDraft(string $email): JsonResponse
    {
        // Decode email if it was URL encoded
        $email = urldecode($email);
        $cacheKey = 'registration_draft:' . $email;
        
        $draft = Cache::get($cacheKey);

        if (!$draft) {
             // Fallback: Check if there's an existing verified email in cache
             // This helps if the user refreshes after verification but before saving draft
             $verificationKey = 'email_verification:' . $email;
             $verificationData = Cache::get($verificationKey);
             
             if ($verificationData && $verificationData['status'] === 'verified') {
                 return response()->json([
                     'draft' => [
                         'email' => $email,
                         'token' => $verificationData['token'],
                         'is_verified' => true
                     ]
                 ]);
             }

            return response()->json([
                'draft' => null,
                'message' => 'No draft found'
            ]);
        }

        return response()->json([
            'draft' => $draft
        ]);
    }

}
