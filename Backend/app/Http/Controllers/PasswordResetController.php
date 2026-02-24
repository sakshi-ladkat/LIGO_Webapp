<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Hash;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Support\Str;
use App\Models\User;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use App\Mail\ResetPasswordMail;

class PasswordResetController extends Controller
{
    /**
     * Send Reset Email Link (Forgot Password)
     */
    public function sendResetLink(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        // Check user exists
        $user = User::where('email', $request->email)->first();
        if (!$user) {
            return response()->json(['message' => 'If this email exists, a reset link has been sent.'], 200);
        }

        // Generate Token
        $token = Password::broker()->createToken($user);
        
        // Add User ID foreign key and expiration to track who used it
        DB::table('password_reset_tokens')
            ->where('email', $user->email)
            ->update([
                'user_id' => $user->id,
                'expires_at' => now()->addMinutes(config('auth.passwords.users.expire', 60))
            ]);

        // Generate Link pointing to our frontend SPA
        $frontendUrl = rtrim(config('frontend.url'), '/');
        $resetLink = $frontendUrl . '/#/setup-password?mode=reset&token=' . $token . '&email=' . urlencode($request->email);

        // LOG LINK FOR DEBUGGING
        \Log::info('PASSWORD RESET LINK (FORGOT PASSWORD): ' . $resetLink);

        // Send Reset Password Email
        $name = $user->username ?? 'User';
        Mail::to($user->email)->send(new ResetPasswordMail($resetLink, $name));
        
        return response()->json([
            'message' => 'Reset link sent! Please check your email.',
            'debug_link' => $resetLink // REMOVE IN PRODUCTION
        ]);
    }

    /**
     * Show Reset Form (Using Existing Blade View)
     */
    public function showResetForm(Request $request)
    {
        return view('auth.passwords.setPassword', [
            'token' => $request->token,
            'email' => $request->email,
            'isReset' => true // Flag to change title/text
        ]);
    }

    /**
     * Handle Reset Password Submission
     */
    public function reset(Request $request)
    {
        $request->validate([
            'token' => 'required',
            'email' => 'required|email',
            'password' => 'required|min:8|confirmed',
        ]);

        // Attempt Reset
        $status = Password::broker()->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function ($user, $password) {
                $user->forceFill([
                    'password' => Hash::make($password)
                ])->setRememberToken(Str::random(60));

                $user->save();

                event(new PasswordReset($user));
                \Log::info("Password updated successfully for email: {$user->email}");
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json([
                'message' => 'Password reset successfully! You can now login.'
            ], 200);
        }

        // Return error
        return response()->json([
            'message' => __($status)
        ], 400);
    }

    /**
     * Change Password (Authenticated User - Dashboard)
     */
    public function changePassword(Request $request)
    {
        $request->validate([
            'current_password' => 'required',
            'new_password' => 'required|min:8|confirmed|different:current_password',
        ]);

        $user = auth()->user();

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'Current password does not match.'], 400);
        }

        $user->forceFill([
            'password' => Hash::make($request->new_password)
        ])->setRememberToken(Str::random(60));
        
        $user->save();

        return response()->json(['message' => 'Password changed successfully!']);
    }
}
