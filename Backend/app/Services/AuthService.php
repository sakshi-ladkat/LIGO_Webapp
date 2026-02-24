<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class AuthService
{
    /**
     * Authenticate user and generate session
     */
    public function login(string $username, string $password): array
    {
        $user = User::where('username', $username)
            ->orWhere('email', $username)
            ->first();

        if (!$user || !Hash::check($password, $user->password)) {
            throw ValidationException::withMessages([
                'username' => ['The provided credentials are incorrect.'],
            ]);
        }

        // Revoke any previous tokens for this device/session
        $user->tokens()->where('name', 'spa-session')->delete();

        // Issue a new Sanctum personal access token
        $token = $user->createToken('spa-session')->plainTextToken;

        return [
            'user'    => $user->load('registration', 'institute', 'roles.permissions'),
            'token'   => $token,
            'message' => 'Login successful',
        ];
    }

    /**
     * Logout user and destroy session
     */
    public function logout(): array
    {
        // Revoke only the current request's token
        Auth::user()?->currentAccessToken()?->delete();

        return [
            'message' => 'Logout successful',
        ];
    }

    /**
     * Get authenticated user
     */
    public function getAuthenticatedUser(): ?User
    {
        return Auth::user()?->load('registration', 'institute', 'roles.permissions');
    }

    /**
     * Refresh user session
     */
    public function refreshSession(): array
    {
        $user = $this->getAuthenticatedUser();

        if (!$user) {
            throw new \Exception('Unauthenticated');
        }

        session()->regenerate();

        return [
            'user' => $user,
            'message' => 'Session refreshed'
        ];
    }

    /**
     * Update user profile
     */
    public function updateProfile(User $user, array $data): User
    {
        if (isset($data['email']) && $data['email'] !== $user->email) {
            $exists = User::where('email', $data['email'])
                ->where('id', '!=', $user->id)
                ->exists();
            
            if ($exists) {
                throw ValidationException::withMessages([
                    'email' => ['Email already in use.'],
                ]);
            }
            
            $user->email = $data['email'];
        }

        if (isset($data['username']) && $data['username'] !== $user->username) {
            $exists = User::where('username', $data['username'])
                ->where('id', '!=', $user->id)
                ->exists();
            
            if ($exists) {
                throw ValidationException::withMessages([
                    'username' => ['Username already taken.'],
                ]);
            }
            
            $user->username = $data['username'];
        }

        $user->save();

        return $user->fresh()->load('registration', 'institute', 'roles.permissions');
    }

    /**
     * Change user password
     */
    public function changePassword(User $user, string $currentPassword, string $newPassword): array
    {
        if (!Hash::check($currentPassword, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Current password is incorrect.'],
            ]);
        }

        $user->password = Hash::make($newPassword);
        $user->save();

        return [
            'message' => 'Password changed successfully'
        ];
    }
}
