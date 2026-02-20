<?php

namespace App\Http\Controllers;

use App\Models\Continent;
use App\Models\Country;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class LocationController extends Controller
{
    /**
     * Get list of all active continents
     */
    public function getContinents(): JsonResponse
    {
        Log::info('Accessing getContinents API');
        try {
            $continents = Continent::active()
                ->orderBy('name')
                ->get(['id', 'name', 'code']);

            Log::info('Continents fetched successfully', ['count' => $continents->count()]);
            // ✅ Return plain array
            return response()->json($continents);
        } catch (\Exception $e) {
            Log::error('Error fetching continents', ['message' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to fetch continents'], 500);
        }
    }

    /**
     * Get countries by continent ID
     */
    public function getCountriesByContinent(Request $request): JsonResponse
    {
        Log::info('Accessing getCountriesByContinent API', ['params' => $request->all()]);

        try {
            $request->validate([
                'continent_id' => 'required|exists:continents,id'
            ]);

            $countries = Country::active()
                ->where('continent_id', $request->continent_id)
                ->orderBy('name')
                ->get(['id', 'name', 'code', 'phone_code']);

            Log::info('Countries fetched successfully', ['continent_id' => $request->continent_id, 'count' => $countries->count()]);
          
            return response()->json($countries);
        } catch (\Exception $e) {
            Log::error('Error fetching countries', ['message' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to fetch countries'], 500);
        }
    }
}
