<?php

namespace App\Http\Controllers;

use App\Services\AuthService;
use App\Http\Requests\LoginRequest;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AuthController extends Controller
{
    protected AuthService $authService;

    public function __construct(AuthService $authService)
    {
        $this->authService = $authService;
    }

    /**
     * Login user
     */
    public function login(LoginRequest $request): JsonResponse
    {
        try {
            $result = $this->authService->login(
                $request->input('username'),
                $request->input('password')
            );

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'message' => $e->getMessage()
            ], 401);
        }
    }

    /**
     * Logout user
     */
    public function logout(): JsonResponse
    {
        $result = $this->authService->logout();
        return response()->json($result);
    }

    /**
     * Get authenticated user
     */
    public function me(): JsonResponse
    {
        try {
            $user = $this->authService->getAuthenticatedUser();

            if (!$user) {
                return response()->json([
                    'message' => 'Unauthenticated'
                ], 401);
            }

            return response()->json([
                'user' => $user
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => $e->getMessage()
            ], 401);
        }
    }

    /**
     * Refresh session
     */
    public function refresh(): JsonResponse
    {
        try {
            $result = $this->authService->refreshSession();
            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'message' => $e->getMessage()
            ], 401);
        }
    }

    /**
     * Update user profile
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $request->validate([
            'username' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|max:255'
        ]);

        try {
            $user = $this->authService->getAuthenticatedUser();

            if (!$user) {
                return response()->json([
                    'message' => 'Unauthenticated'
                ], 401);
            }

            $updatedUser = $this->authService->updateProfile(
                $user,
                $request->only(['username', 'email'])
            );

            return response()->json([
                'message' => 'Profile updated successfully',
                'user' => $updatedUser
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => $e->getMessage()
            ], 422);
        }
    }

    /**
     * Change password
     */
    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8|confirmed'
        ]);

        try {
            $user = $this->authService->getAuthenticatedUser();

            if (!$user) {
                return response()->json([
                    'message' => 'Unauthenticated'
                ], 401);
            }

            $result = $this->authService->changePassword(
                $user,
                $request->input('current_password'),
                $request->input('new_password')
            );

            return response()->json($result);
        } catch (\Exception $e) {
            return response()->json([
                'message' => $e->getMessage()
            ], 422);
        }
    }
}
