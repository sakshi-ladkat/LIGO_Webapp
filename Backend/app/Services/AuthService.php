<?php

namespace App\Services;

use App\Contracts\AuthServiceInterface;
use App\Models\RefreshToken;
use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class AuthService implements AuthServiceInterface
{
    private int $accessTtl = 7200; // 2 hours
    private int $refreshTtl = 604800; // 7 days

    /**
     * Issue a JWT access token + persisted refresh token.
     */
    public function issueTokens(User $user, Request $request): array
    {
        $accessToken = $this->buildJwt($user);
        $rawRefresh = $this->createRefreshToken($user, $request);

        return [
            'access_token' => $accessToken,
            'refresh_token' => $rawRefresh,
            'token_type' => 'Bearer',
            'expires_in' => $this->accessTtl,
        ];
    }

    /**
     * Rotate: revoke old refresh token and issue a new token pair.
     */
    public function refresh(string $rawToken, Request $request): array
    {
        $tokenRecord = $this->findActiveToken($rawToken);

        if (!$tokenRecord) {
            throw new \Exception('Invalid or expired refresh token.', 401);
        }

        // Revoke old token (rotation)
        $tokenRecord->update([
            'is_active' => false,
            'revoked_at' => now(),
        ]);

        $user = $tokenRecord->user;

        return $this->issueTokens($user, $request);
    }

    /**
     * Revoke the refresh token (logout).
     */
    public function logout(string $rawToken): void
    {
        $tokenRecord = $this->findActiveToken($rawToken);

        if ($tokenRecord) {
            $tokenRecord->update([
                'is_active' => false,
                'revoked_at' => now(),
            ]);
        }
    }

    // ──────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────

    private function buildJwt(User $user): string
    {
        $key = env('JWT_SECRET', config('app.key'));

        $payload = [
            'iss' => env('APP_URL', 'http://localhost'),
            'sub' => $user->user_id,
            'email' => $user->email,
            'iat' => time(),
            'exp' => time() + $this->accessTtl,
        ];

        return JWT::encode($payload, $key, 'HS256');
    }

    private function createRefreshToken(User $user, Request $request): string
    {
        // Generate a cryptographically secure random token
        $rawToken = Str::random(64);
        $hash = hash('sha256', $rawToken);

        RefreshToken::create([
            'user_id' => $user->user_id,
            'token_hash' => $hash,
            'device_id' => $request->header('X-Device-Id'),
            'user_agent' => $request->userAgent(),
            'ip' => $request->ip(),
            'is_active' => true,
            'expires_at' => now()->addSeconds($this->refreshTtl),
        ]);

        return $rawToken; // Only time the raw token is exposed
    }

    private function findActiveToken(string $rawToken): ?RefreshToken
    {
        $hash = hash('sha256', $rawToken);

        return RefreshToken::active()
            ->where('token_hash', $hash)
            ->with('user')
            ->first();
    }
}