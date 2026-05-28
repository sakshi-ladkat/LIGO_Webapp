<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

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

        // 3. Resolve actual path on disk via the local disk (root is app/private)
        // If the path in DB starts with private/ (due to legacy bug), strip it as the disk root already includes it
        $cleanPath = str_starts_with($idCardPath, 'private/')
            ? substr($idCardPath, 8)
            : $idCardPath;

        if (!Storage::disk('local')->exists($cleanPath)) {
            Log::error("File missing on disk: " . Storage::disk('local')->path($cleanPath));
            return response()->json(['error' => 'File missing from internal storage'], 404);
        }

        $absolutePath = Storage::disk('local')->path($cleanPath);

        // 4. Return secure response
        return response()->file($absolutePath);
    }

    /**
     * View/Download secure file by direct path.
     */
    public function viewFile(Request $request)
    {
        $authUserId = $request->auth_user_id;
        if (!$authUserId) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $path = $request->query('path');
        if (empty($path)) {
            return response()->json(['error' => 'Path parameter is required'], 400);
        }

        // Prevent directory traversal attacks
        if (str_contains($path, '..') || str_starts_with($path, '/') || str_starts_with($path, '\\')) {
            return response()->json(['error' => 'Invalid path'], 400);
        }

        Log::info("Attempting direct file access for Path: {$path} by Caller: {$authUserId}");

        // Resolve actual path on disk via the local disk (root is app/private)
        $cleanPath = str_starts_with($path, 'private/')
            ? substr($path, 8)
            : $path;

        if (!Storage::disk('local')->exists($cleanPath)) {
            Log::error("File missing on disk: " . Storage::disk('local')->path($cleanPath));
            return response()->json(['error' => 'File not found'], 404);
        }

        $absolutePath = Storage::disk('local')->path($cleanPath);

        return response()->file($absolutePath);
    }
}