<?php

namespace App\Http\Controllers;

use App\Models\Service;
use Illuminate\Http\JsonResponse;

class ServiceController extends Controller
{
    /**
     * GET /api/auth/review/services
     *
     * Returns all active services with their active subservices nested inside.
     * Used by the review modal service picker.
     */
    public function servicesWithSubservices(): JsonResponse
    {
        $services = Service::where('is_active', true)
            ->with(['subservices' => fn($q) => $q->where('is_active', true)->orderBy('name')])
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'description', 'subsystem_id', 'is_ligo']);

        return response()->json($services);
    }
}
