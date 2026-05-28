<?php

namespace App\Http\Controllers;

use App\Services\InvitationService;
use App\Models\UserInvitation;
use Illuminate\Http\Request;

class InvitationController extends Controller
{
    protected InvitationService $invitationService;

    public function __construct(InvitationService $invitationService)
    {
        $this->invitationService = $invitationService;
    }

    /**
     * Display a listing of invitations sent by the authenticated supervisor.
     */
    public function index(Request $request)
    {
        $supervisorId = $request->auth_user_id;

        $invitations = UserInvitation::where('invited_by', $supervisorId)
            ->orderBy('created_at', 'desc')
            ->get();
            
        $invitations->transform(function($inv) {
            $userExists = \Illuminate\Support\Facades\DB::table('users')->where('email', $inv->email)->exists();
            $inv->status = $userExists ? 'accepted' : 'failed';
            return $inv;
        });

        return response()->json($invitations);
    }

    /**
     * Create and send a new invitation.
     */
    public function invite(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'role' => 'nullable|string'
        ]);

        try {
            $invitation = $this->invitationService->inviteUser(
                $request->input('email'),
                $request->input('role'),
                $request->auth_user_id
            );

            return response()->json([
                'message' => 'Invitation sent successfully.',
                'invitation' => $invitation
            ], 201);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    /**
     * Resend an existing invitation.
     */
    public function resend(Request $request, $id)
    {
        try {
            $invitation = $this->invitationService->resendInvitation((int)$id, $request->auth_user_id);

            return response()->json([
                'message' => 'Invitation resent successfully.',
                'invitation' => $invitation
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    /**
     * Cancel a pending invitation.
     */
    public function cancel(Request $request, $id)
    {
        try {
            $invitation = $this->invitationService->cancelInvitation((int)$id, $request->auth_user_id);

            return response()->json([
                'message' => 'Invitation cancelled successfully.',
                'invitation' => $invitation
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 422);
        }
    }

    /**
     * Verify the invitation token validity (Public endpoint).
     */
    public function verify(Request $request)
    {
        $request->validate([
            'token' => 'required|string'
        ]);

        try {
            $invitation = $this->invitationService->verifyInvitationToken($request->input('token'));

            return response()->json([
                'message' => 'Token is valid.',
                'invitation' => [
                    'email' => $invitation->email,
                    'role' => $invitation->role
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Accept invitation and register the user (Public endpoint).
     */
    public function accept(Request $request)
    {
        $request->validate([
            'token' => 'required|string',
            'name' => 'required|string|max:255',
            'password' => 'required|string|min:6|confirmed'
        ]);

        try {
            $result = $this->invitationService->acceptInvitation(
                $request->input('token'),
                $request->input('name'),
                $request->input('password'),
                $request
            );

            return response()->json([
                'message' => 'Registration completed successfully.',
                'user' => $result['user'],
                'tokens' => $result['tokens']
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }
}
