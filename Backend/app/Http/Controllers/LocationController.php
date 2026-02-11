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
        $continents = Continent::active()
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        // ✅ Return plain array
        return response()->json($continents);
    }

    /**
     * Get countries by continent ID
     */
    public function getCountriesByContinent(Request $request): JsonResponse
    {
        Log::info('Accessing getCountriesByContinent API', ['params' => $request->all()]);

        $request->validate([
            'continent_id' => 'required|exists:continents,id'
        ]);

        $countries = Country::active()
            ->where('continent_id', $request->continent_id)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'phone_code']);

      
        return response()->json($countries);
    }
}
