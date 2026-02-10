<?php

namespace App\Http\Controllers;

use App\Models\Continent;
use App\Models\Country;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LocationController extends Controller
{
    /**
     * Get list of all active continents
     */
    public function getContinents(): JsonResponse
    {
        $continents = Continent::active()
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return response()->json([
            'continents' => $continents
        ]);
    }

    /**
     * Get countries by continent ID
     */
    public function getCountriesByContinent(Request $request): JsonResponse
    {
        $request->validate([
            'continent_id' => 'required|exists:continents,id'
        ]);

        $countries = Country::active()
            ->where('continent_id', $request->continent_id)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'phone_code']);

        return response()->json([
            'countries' => $countries
        ]);
    }

    /**
     * Get countries by continent name (legacy support)
     */
    public function getCountriesByContinentName(Request $request): JsonResponse
    {
        $request->validate([
            'continent' => 'required|string'
        ]);

        // Find continent by name
        $continent = Continent::where('name', $request->continent)->first();

        if (!$continent) {
            return response()->json([
                'message' => 'Continent not found',
                'countries' => []
            ], 404);
        }

        $countries = Country::active()
            ->where('continent_id', $continent->id)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'phone_code']);

        return response()->json([
            'countries' => $countries
        ]);
    }

    /**
     * Get a specific country
     */
    public function getCountry($id): JsonResponse
    {
        $country = Country::with('continent')->findOrFail($id);

        return response()->json([
            'country' => $country
        ]);
    }

    /**
     * Get all countries (for admin/management)
     */
    public function getAllCountries(): JsonResponse
    {
        $countries = Country::with('continent')
            ->active()
            ->orderBy('name')
            ->get();

        return response()->json([
            'countries' => $countries
        ]);
    }
}
