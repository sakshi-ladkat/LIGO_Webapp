<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class RegistrationController extends Controller
{
    public function submit(Request $request)
    {
        // Auth user ID is securely provided by our custom JwtMiddleware
        $userId = $request->auth_user_id;

        if (!$userId) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        try {
            DB::beginTransaction();
            
            $instituteId = $request->input('institute');
            if ($instituteId === 'other') {
                $otherName = $request->input('otherInstitute');
                if (!$otherName) {
                    DB::rollBack();
                    return response()->json(['error' => 'Please provide the custom institute name.'], 422);
                }
                
                $newInst = \App\Models\Institute::create([
                    'name' => $otherName,
                    'is_active' => false // Pending approval
                ]);
                $instituteId = $newInst->id;
            }

            // Sync User Affiliation logic
            if ($instituteId) {
                DB::table('user_affilation')->updateOrInsert(
                    ['user_id' => $userId],
                    [
                        'institute_id' => $instituteId,
                        'category_id' => $request->input('designation')
                    ]
                );
            }
            
            $user = User::where('user_id', $userId)->first();
            
            if ($user && $user->status === 'onboarding') {
                $user->update(['status' => 'filled']);
            }

            DB::commit();

            return response()->json([
                'message' => 'Registration completed successfully.',
                'user' => $user
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
