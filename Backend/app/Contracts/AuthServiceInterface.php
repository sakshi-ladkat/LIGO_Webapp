<?php

namespace App\Contracts;

use App\Models\User;
use Illuminate\Http\Request;

interface AuthServiceInterface
{
    /**
     * Issue a JWT access token and a refresh token for the given user.
     * Returns ['access_token' => ..., 'refresh_token' => ..., 'expires_in' => ...].
     */
    public function issueTokens(User $user, Request $request): array;

    /**
     * Rotate the refresh token: revoke the old one, issue a new token pair.
     * Throws \Exception if the token is invalid or expired.
     */
    public function refresh(string $rawToken, Request $request): array;

    /**
     * Revoke the given refresh token (logout).
     * Silently ignores unknown tokens.
     */
    public function logout(string $rawToken): void;
}
