<?php

namespace App\Services;

use App\Models\User;
use App\Models\Role;
use App\Models\UserInvitation;
use App\Models\InvitationLog;
use App\Mail\InvitationMail;
use App\Contracts\AuthServiceInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Carbon\Carbon;

class InvitationService
{
    protected AuthServiceInterface $authService;

    public function __construct(AuthServiceInterface $authService)
    {
        $this->authService = $authService;
    }

    /**
     * Invite a new user.
     */
    public function inviteUser(string $email, ?string $role, string $supervisorId): UserInvitation
    {
        $email = trim(strtolower($email));

        // 1. Validate email structure
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \Exception('Invalid email address format.');
        }

        // 2. Prevent duplicate pending invitations
        $pendingExists = UserInvitation::where('email', $email)
            ->where('status', 'pending')
            ->exists();

        if ($pendingExists) {
            throw new \Exception('A pending invitation already exists for this email address.');
        }

        // 3. Prevent inviting existing registered users
        $userExists = User::where('email', $email)->exists();
        if ($userExists) {
            throw new \Exception('A user with this email address already exists in the system.');
        }

        // 4. Generate secure token
        $plaintextToken = Str::random(40);
        $hashedToken = hash('sha256', $plaintextToken);

        return DB::transaction(function () use ($email, $role, $supervisorId, $plaintextToken, $hashedToken) {
            // 5. Create invitation
            $invitation = UserInvitation::create([
                'email' => $email,
                'token' => $hashedToken,
                'invited_by' => $supervisorId,
                'role' => $role ?: 'user',
                'status' => 'pending',
                'expires_at' => Carbon::now()->addDays(7),
            ]);

            // 6. Write activity log
            InvitationLog::create([
                'invitation_id' => $invitation->id,
                'action' => 'sent',
                'performed_by' => $supervisorId,
                'remarks' => "Invitation sent by supervisor for role: " . ($role ?: 'user')
            ]);

            // 7. Dispatch email after the invitation is committed
            DB::afterCommit(function () use ($invitation, $plaintextToken, $role) {
                Mail::to($invitation->email)->send(new InvitationMail($plaintextToken, $role ?: 'user', $invitation->created_at, $invitation->expires_at));
            });

            return $invitation;
        });
    }

    /**
     * Resend an invitation.
     */
    public function resendInvitation(int $id, string $supervisorId): UserInvitation
    {
        $invitation = UserInvitation::findOrFail($id);

        // 1. Verify that the supervisor is the one who originally invited
        if ($invitation->invited_by !== $supervisorId) {
            throw new \Exception('Unauthorized: You did not send this invitation.');
        }

        // 2. Prevent resending accepted invitations
        if ($invitation->status === 'accepted') {
            throw new \Exception('Cannot resend: This invitation has already been accepted.');
        }

        // 3. Generate a new token
        $plaintextToken = Str::random(40);
        $hashedToken = hash('sha256', $plaintextToken);

        return DB::transaction(function () use ($invitation, $plaintextToken, $hashedToken, $supervisorId) {
            // 4. Update the invitation record
            $invitation->update([
                'token' => $hashedToken,
                'status' => 'pending',
                'expires_at' => Carbon::now()->addDays(7),
                'updated_at' => Carbon::now(),
            ]);

            // 5. Write activity log
            InvitationLog::create([
                'invitation_id' => $invitation->id,
                'action' => 'resent',
                'performed_by' => $supervisorId,
                'remarks' => 'Invitation resent by supervisor. Expiry extended.'
            ]);

            // 6. Dispatch email after the invitation is committed
            DB::afterCommit(function () use ($invitation, $plaintextToken) {
                Mail::to($invitation->email)->send(new InvitationMail($plaintextToken, $invitation->role ?: 'user', $invitation->created_at, $invitation->expires_at));
            });

            return $invitation;
        });
    }

    /**
     * Cancel an active invitation.
     */
    public function cancelInvitation(int $id, string $supervisorId): UserInvitation
    {
        $invitation = UserInvitation::findOrFail($id);

        // 1. Verify authorization
        if ($invitation->invited_by !== $supervisorId) {
            throw new \Exception('Unauthorized: You did not send this invitation.');
        }

        // 2. Ensure only pending invitations can be cancelled
        if ($invitation->status !== 'pending') {
            throw new \Exception('Only pending invitations can be cancelled.');
        }

        return DB::transaction(function () use ($invitation, $supervisorId) {
            $invitation->update([
                'status' => 'cancelled',
                'updated_at' => Carbon::now(),
            ]);

            InvitationLog::create([
                'invitation_id' => $invitation->id,
                'action' => 'cancelled',
                'performed_by' => $supervisorId,
                'remarks' => 'Invitation cancelled by supervisor.'
            ]);

            return $invitation;
        });
    }

    /**
     * Verify the plaintext invitation token.
     */
    public function verifyInvitationToken(string $token): UserInvitation
    {
        $hashedToken = hash('sha256', $token);
        $invitation = UserInvitation::where('token', $hashedToken)->first();

        if (!$invitation) {
            throw new \Exception('Invalid or expired invitation token.');
        }

        if ($invitation->status !== 'pending') {
            throw new \Exception("This invitation is no longer active (Status: {$invitation->status}).");
        }

        if ($invitation->expires_at->isPast()) {
            DB::transaction(function () use ($invitation) {
                $invitation->update(['status' => 'expired']);
                InvitationLog::create([
                    'invitation_id' => $invitation->id,
                    'action' => 'expired',
                    'remarks' => 'Invitation expired automatically upon verification.'
                ]);
            });

            throw new \Exception('This invitation has expired.');
        }

        return $invitation;
    }

    /**
     * Accept invitation and register user.
     */
    public function acceptInvitation(string $token, string $name, string $password, $request): array
    {
        $invitation = $this->verifyInvitationToken($token);

        return DB::transaction(function () use ($invitation, $name, $password, $request) {
            // 1. Create the new user
            $user = User::create([
                'email' => $invitation->email,
                'password' => Hash::make($password),
                'status' => 'onboarding',
            ]);

            // 2. Create the UserProfile
            $parts = explode(' ', trim($name), 2);
            $firstName = $parts[0];
            $lastName = isset($parts[1]) ? $parts[1] : '';

            DB::table('user_profiles')->insert([
                'user_id' => $user->user_id,
                'first_name' => $firstName,
                'last_name' => $lastName ?: 'User',
                'date_of_birth' => '2000-01-01', // Default placeholder required by strict non-nullable DB schema
                'created_at' => now(),
                'updated_at' => now()
            ]);

            // 3. Attach requested role
            $roleSlug = $invitation->role ?: 'user';
            $roleRecord = Role::where('slug', $roleSlug)->first();
            if ($roleRecord) {
                $user->roles()->attach($roleRecord->id, ['is_active' => true]);
            }

            // 4. Update the invitation status
            $invitation->update([
                'status' => 'accepted',
                'invited_user_id' => $user->user_id,
                'accepted_at' => now(),
            ]);

            // 5. Write activity log
            InvitationLog::create([
                'invitation_id' => $invitation->id,
                'action' => 'accepted',
                'performed_by' => $user->user_id,
                'remarks' => 'Invitation accepted; user successfully registered and onboarded.'
            ]);

            // 6. Generate JWT access and refresh token pair so they are logged in instantly
            $tokens = $this->authService->issueTokens($user, $request);

            return [
                'user' => $user,
                'tokens' => $tokens
            ];
        });
    }
}
