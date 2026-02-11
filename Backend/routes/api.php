<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\InstituteController;
use App\Http\Controllers\LocationController;
use App\Http\Controllers\RegistrationController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});


Route::prefix('reference')
    ->withoutMiddleware('throttle:api')
    ->middleware('throttle:1000,1')
    ->group(function () {
        Route::get('institutes', [InstituteController::class, 'index']);
        Route::get('continents', [LocationController::class, 'getContinents']);
        Route::get('countries', [LocationController::class, 'getcountriesByContinent']);
    });

Route::prefix('registration')
    ->withoutMiddleware('throttle:api')
    ->middleware('throttle:1000,1')
    ->group(function () {
        Route::post('/send-verification', [RegistrationController::class, 'sendVerificationLink']);
        Route::post('/save-data', [RegistrationController::class, 'saveRegistrationData']);
        Route::post('/draft', [RegistrationController::class, 'saveDraft']);
        Route::get('/draft/{email}', [RegistrationController::class, 'getDraft']);
    });
