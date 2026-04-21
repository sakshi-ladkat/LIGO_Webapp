<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\InstituteController;
use App\Http\Controllers\LocationController;
use App\Http\Middleware\JwtMiddleware;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ReferenceController;
use \App\Http\Controllers\RegistrationController;
use App\Http\Controllers\ReviewController;

/*
 |--------------------------------------------------------------------------
 | API Routes
 |--------------------------------------------------------------------------
 */


// reference data required for the registration form like institutes, continents, countries etc.
Route::prefix('reference')
    ->group(function () {
        Route::get('/institutes', [InstituteController::class , 'index']);
        Route::get('/institutes/{id}', [InstituteController::class , 'show']);
        Route::get('/continents', [LocationController::class , 'getContinents']);
        Route::get('/countries', [LocationController::class , 'getCountriesByContinent']);
        Route::get('/all-countries', [LocationController::class , 'getAllCountries']);
        Route::get('/categories', [ReferenceController::class, 'getCategories']);
        Route::get('/supervisors', [ReferenceController::class, 'getSupervisors']);
        Route::get('/titles', [ReferenceController::class, 'getTitles']);
    });

// ── Public auth routes ────────────────────────────────────────────────────
Route::prefix('auth')->group(function () {
    Route::post('/otp/send', [AuthController::class , 'sendOtp']);
    Route::post('/otp/verify', [AuthController::class , 'verifyOtp']);
    Route::post('/refresh', [AuthController::class , 'refresh']);

    // Requires a valid JWT access token
    Route::middleware(JwtMiddleware::class)->group(function () {
            Route::post('/logout', [AuthController::class , 'logout']);
            Route::get('/me', [AuthController::class , 'me']);
            Route::patch('/me', [AuthController::class , 'updateProfile']);
            Route::post('/registration', [RegistrationController::class , 'submit']);

            // ── Review / Approval workflow ────────────────────────────────
            Route::prefix('review')->group(function () {
                Route::get('/applications',           [ReviewController::class, 'index']);
                Route::get('/my-application',         [ReviewController::class, 'myApplication']);
                Route::post('/applications/{id}/decide', [ReviewController::class, 'decide']);
            });
        }
        );
    });