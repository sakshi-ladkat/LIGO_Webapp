<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class FileController extends Controller
{
    /**
     * Get a secure file by user ID.
     */
    public function show(Request $request, $id)
    {
        // 1. Validate authorization
        // JWT Middleware handles authentication.
        // E.g., block if the requester isn't a reviewer or the owner:
        $authUserId = $request->auth_user_id;
        if (!$authUserId) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        Log::info("Attempting secure file access for target User ID: {$id} by Caller: {$authUserId}");

        // 2. Fetch file path from DB
        $idCardPath = DB::table('user_affilation')->where('user_id', $id)->value('id_card_path');

        if (empty($idCardPath)) {
            Log::error("File path missing in DataBase for user_id: {$id}");
            return response()->json(['error' => 'File not found'], 404);
        }

        // 3. Construct File path to the private directory
        $path = storage_path('app/' . $idCardPath);

        if (!file_exists($path)) {
            Log::error("File missing on disk: {$path}");
            return response()->json(['error' => 'File missing from internal storage'], 404);
        }

        // 4. Return secure response
        return response()->file($path);
    }
}
