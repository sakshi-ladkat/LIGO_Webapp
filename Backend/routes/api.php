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

// reference data required for the registration form like institutes, continents, countries etc.
Route::prefix('reference')
    ->group(function () {
        Route::get('institutes', [InstituteController::class, 'index']);
        Route::get('continents', [LocationController::class, 'getContinents']);
        Route::get('countries', [LocationController::class, 'getcountriesByContinent']);
    });

Route::prefix('registration')
    ->group(function () {
        Route::post('/send-verification', [RegistrationController::class, 'sendVerificationLink']);
        Route::get('/verify-email', [RegistrationController::class, 'verifyEmail']);
        Route::post('/save-data', [RegistrationController::class, 'saveRegistrationData']);
        Route::get('/setup-password', [RegistrationController::class, 'setupPasswordPage']); // Triggers redirect to Web Blade View
        Route::post('/resend-verification', [RegistrationController::class, 'resendVerificationLink']);
        Route::post('/draft', [RegistrationController::class, 'saveDraft']);
        Route::get('/draft/{email}', [RegistrationController::class, 'getDraft']);
        Route::post('/set-password', [RegistrationController::class, 'setPassword']);
    });

// Auth Routes
use App\Http\Controllers\AuthController;
use App\Http\Controllers\PasswordResetController;

Route::prefix('auth')->group(function () {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/password/email', [PasswordResetController::class, 'sendResetLink']); // Forgot Password Link
    
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [AuthController::class, 'logout']);
        Route::post('/change-password', [AuthController::class, 'changePassword']);
        Route::get('/me', [AuthController::class, 'me']);
    });
});

// Dashboard Routes (all require auth)
use App\Http\Controllers\DashboardController;

Route::middleware('auth:sanctum')->prefix('dashboard')->group(function () {
    Route::get('/profile',                [DashboardController::class, 'profile']);
    Route::get('/systems',                [DashboardController::class, 'systems']);
    Route::get('/institutes-by-system',   [DashboardController::class, 'institutesBySystem']);
    Route::get('/sub-systems',            [DashboardController::class, 'subSystems']);
    Route::post('/send-request',          [DashboardController::class, 'sendRequest']);
});

