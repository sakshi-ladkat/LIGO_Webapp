<?php

namespace App\Http\Controllers;

use App\Models\SshKey;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class SshKeyController extends Controller
{
    /**
     * POST /api/auth/ssh-key
     */
    public function store(Request $request): JsonResponse
    {
        $application = \Illuminate\Support\Facades\DB::table('applications')->where('user_id', $request->auth_user_id)->first();
        $hasApproval = false;
        if ($application) {
            $hasApproval = \Illuminate\Support\Facades\DB::table('application_approvals as aa')
                ->join('workflow_steps as ws', 'aa.workflow_step_id', '=', 'ws.workflow_step_id')
                ->join('roles as r', 'ws.role_id', '=', 'r.id')
                ->where('aa.application_id', $application->id)
                ->where('r.slug', 'li_coordinator')
                ->where('aa.status', 'approved')
                ->exists();
        }

        if (!$hasApproval) {
            return response()->json([
                'error' => 'SSH setup is not available until LI Coordinator approval.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'public_key' => ['required', 'string', function ($attribute, $value, $fail) {
                if (!$this->isValidSshPublicKey($value)) {
                    $fail('The '.$attribute.' is not a valid SSH public key.');
                }
                if ($this->isPrivateKey($value)) {
                    $fail('For security reasons, private keys are not allowed.');
                }
            }],
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $publicKey = trim($request->public_key);
        $fingerprint = $this->generateFingerprint($publicKey);
        $hash = hash('sha256', $publicKey);

        $sshKey = SshKey::updateOrCreate(
            ['user_id' => $request->auth_user_id],
            [
                'public_key' => $publicKey,
                'fingerprint' => $fingerprint,
                'hash' => $hash,
                'status' => 'active'
            ]
        );

        return response()->json([
            'message' => 'SSH Key uploaded successfully.',
            'fingerprint' => $fingerprint,
            'key' => $sshKey
        ]);
    }

    /**
     * GET /api/auth/ssh-key
     */
    public function index(Request $request): JsonResponse
    {
        $application = \Illuminate\Support\Facades\DB::table('applications')->where('user_id', $request->auth_user_id)->first();
        $hasApproval = false;
        if ($application) {
            $hasApproval = \Illuminate\Support\Facades\DB::table('application_approvals as aa')
                ->join('workflow_steps as ws', 'aa.workflow_step_id', '=', 'ws.workflow_step_id')
                ->join('roles as r', 'ws.role_id', '=', 'r.id')
                ->where('aa.application_id', $application->id)
                ->where('r.slug', 'li_coordinator')
                ->where('aa.status', 'approved')
                ->exists();
        }

        if (!$hasApproval) {
            return response()->json([
                'error' => 'SSH setup is not available until LI Coordinator approval.'
            ], 403);
        }

        $key = SshKey::where('user_id', $request->auth_user_id)
            ->where('status', 'active')
            ->first();

        return response()->json($key);
    }

    private function isValidSshPublicKey($key): bool
    {
        $patterns = [
            '/^ssh-rsa AAAAB3NzaC1yc2E/',
            '/^ssh-ed25519 AAAAC3NzaC1lZDI1NTE5/',
            '/^ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTY/',
            '/^ssh-dss AAAAB3NzaC1kc3M/'
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $key)) return true;
        }

        return false;
    }

    private function isPrivateKey($key): bool
    {
        return str_contains($key, 'PRIVATE KEY');
    }

    private function generateFingerprint($key): string
    {
        // Extract the base64 part
        $parts = explode(' ', $key);
        if (count($parts) < 2) return 'unknown';
        
        $data = base64_decode($parts[1]);
        $hash = hash('sha256', $data, true);
        return 'SHA256:' . base64_encode($hash);
    }
}
