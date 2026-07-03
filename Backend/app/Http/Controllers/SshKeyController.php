<?php

namespace App\Http\Controllers;

use App\Models\SshKey;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;

class SshKeyController extends Controller
{
    /**
     * POST /api/auth/ssh-key
     */
    public function store(Request $request): JsonResponse
    {
        $application = DB::table('applications')->where('user_id', $request->auth_user_id)->first();
        $hasApproval = false;
        if ($application) {
            $hasApproval = DB::table('application_approvals as aa')
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
            'ssh_key_file' => 'nullable|file|max:2048',
            'ssh_key_text' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if (!$request->hasFile('ssh_key_file') && !$request->filled('ssh_key_text')) {
            return response()->json(['error' => 'Please provide an SSH key either by uploading a file or pasting the text.'], 422);
        }

        $publicKey = '';
        $path = null;

        if ($request->hasFile('ssh_key_file')) {
            $file = $request->file('ssh_key_file');
            // Store using the custom disk
            $path = $file->store('', 'ssh_keys');
            
            if (!$path) {
                return response()->json(['error' => 'Failed to store the SSH key file.'], 500);
            }
            $publicKey = Storage::disk('ssh_keys')->get($path);
        } else {
            $publicKey = $request->input('ssh_key_text');
        }

        $publicKey = trim($publicKey);

        // Validate the content
        if (!$this->isValidSshPublicKey($publicKey)) {
            if ($path) Storage::disk('ssh_keys')->delete($path);
            return response()->json(['error' => 'The provided input does not contain a valid SSH public key.'], 422);
        }

        if ($this->isPrivateKey($publicKey)) {
            if ($path) Storage::disk('ssh_keys')->delete($path);
            return response()->json(['error' => 'For security reasons, private keys are not allowed.'], 422);
        }

        $fingerprint = $this->generateFingerprint($publicKey);
        $hash = hash('sha256', $publicKey);

        // Prevent duplicate keys for the same user
        $exists = SshKey::where('user_id', $request->auth_user_id)->where('hash', $hash)->exists();
        if ($exists) {
            if ($path) Storage::disk('ssh_keys')->delete($path);
            return response()->json(['error' => 'You have already added this SSH key.'], 422);
        }

        $sshKey = SshKey::create([
            'user_id' => $request->auth_user_id,
            'public_key' => $publicKey,
            'fingerprint' => $fingerprint,
            'hash' => $hash,
            'status' => 'active'
        ]);

        // Provision Account now that SSH Key is uploaded
        if ($application && in_array($application->status, ['provisioning_pending', 'approved', 'approved_by_li_coordinator'])) {
            DB::table('applications')->where('id', $application->id)->update([
                'status' => 'completed'
            ]);

            $user = DB::table('users')->where('user_id', $request->auth_user_id)->first();
            if (empty($user->username)) {
                $userProfile = DB::table('user_profiles')->where('user_id', $request->auth_user_id)->first();
                
                // Get UsernameService instance
                $usernameService = app(\App\Services\UsernameService::class);
                $username = $usernameService->generateUnique(
                    $userProfile->first_name ?? 'user',
                    $userProfile->last_name ?? 'name',
                    $userProfile->middle_name ?? null
                );
                
                DB::table('users')->where('user_id', $request->auth_user_id)->update([
                    'status' => 'active',
                    'username' => $username,
                ]);
            } else if ($user->status !== 'active') {
                DB::table('users')->where('user_id', $request->auth_user_id)->update([
                    'status' => 'active'
                ]);
            }
        }

        return response()->json([
            'message' => 'SSH Key uploaded and registered successfully. Account is now active.',
            'fingerprint' => $fingerprint,
            'key' => $sshKey,
            'file_path' => $path
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
