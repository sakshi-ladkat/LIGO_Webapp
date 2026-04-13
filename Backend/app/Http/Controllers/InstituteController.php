<?php

namespace App\Http\Controllers;

use App\Models\Institute;
use Illuminate\Http\JsonResponse;

class InstituteController extends Controller
{
    /**
     * Get all active institutes
     */
    public function index(): JsonResponse
    {
        $institutes = Institute::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'city']);

        //  Return plain array for frontend forEach()
        return response()->json($institutes);
    }

    /**
     * Get a specific institute by ID
     */
    public function show(int $id): JsonResponse
    {
        $institute = Institute::where('is_active', true)
            ->findOrFail($id);

        return response()->json($institute);
    }
}
