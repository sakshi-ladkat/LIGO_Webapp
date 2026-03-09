<?php

namespace App\Http\Controllers;

use App\Models\OTP;
use App\Models\User;
use App\Models\ApprovalRequest;
use App\Mail\OtpMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function sendOtp(Request $request)
    {
        $request->validate(['email' => 'required|email']);
        $email = $request->email;

        $otpCode = rand(100000, 999999);
        $expiresAt = Carbon::now()->addMinutes(5);

        OTP::updateOrCreate(
            ['email' => $email],
            ['otp' => $otpCode, 'expires_at' => $expiresAt]
        );

        Mail::to($email)->send(new OtpMail($otpCode));

        return response()->json(['message' => 'OTP sent successfully']);
    }

    public function verifyOtp(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'otp' => 'required|string',
        ]);

        $otpRecord = OTP::where('email', $request->email)->first();

        if (!$otpRecord || $otpRecord->otp !== $request->otp) {
            return response()->json(['message' => 'Invalid OTP'], 400);
        }

        if (Carbon::now()->greaterThan($otpRecord->expires_at)) {
            return response()->json(['message' => 'OTP expired'], 400);
        }

        $user = User::firstOrCreate(
            ['email' => $request->email],
            [
                'email_verified_at' => Carbon::now(),
                'status' => 'verified'
            ]
        );

        // Optional: Ensure it's marked as verified if user already existed
        if (!$user->email_verified_at) {
            $user->email_verified_at = Carbon::now();
            $user->status = 'verified';
            $user->save();
        }

        $otpRecord->delete();

        // Create a basic token for API auth (assuming Sanctum, else simple session)
        Auth::login($user);
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'message' => 'Email verified successfully',
            'token' => $token,
            'user' => $user
        ]);
    }

    public function submitApproval(Request $request)
    {
        $request->validate([
            'form_data' => 'required|array',
        ]);

        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $approval = ApprovalRequest::create([
            'user_id' => $user->id,
            'form_data' => $request->form_data,
            'status' => 'pending'
        ]);

        return response()->json([
            'message' => 'Approval form submitted successfully',
            'approval_id' => $approval->id
        ]);
    }
}
