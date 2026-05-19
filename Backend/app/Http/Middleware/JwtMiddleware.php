<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Firebase\JWT\ExpiredException;
use Firebase\JWT\SignatureInvalidException;
use Symfony\Component\HttpFoundation\Response;

class JwtMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $authorization = $request->header('Authorization');

        if (!$authorization) {
            $accessToken = $request->header('X-Access-Token');

            if ($accessToken) {
                $authorization = 'Bearer ' . $accessToken;
            }
        }

        if (!$authorization || !str_starts_with($authorization, 'Bearer ')) {
            return response()->json(['error' => 'Unauthorized. No token provided.'], 401);
        }

        $token = substr($authorization, 7);

        try {
            $jwtKey = env('JWT_SECRET', config('app.key'));
            $decoded = JWT::decode($token, new Key($jwtKey, 'HS256'));

            // Attach decoded user_id to the request for downstream use
            $request->merge(['auth_user_id' => $decoded->sub]);
            $request->attributes->set('auth_email', $decoded->email);

            // Blocked user verification
            $user = \Illuminate\Support\Facades\DB::table('users')->where('user_id', $decoded->sub)->first();
            if ($user && $user->is_blocked) {
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
        }
        catch (ExpiredException $e) {
            return response()->json(['error' => 'Token has expired.'], 401);
        }
        catch (SignatureInvalidException $e) {
            return response()->json(['error' => 'Token signature is invalid.'], 401);
        }
        catch (\Exception $e) {
            return response()->json(['error' => 'Invalid token.'], 401);
        }

        return $next($request);
    }
}