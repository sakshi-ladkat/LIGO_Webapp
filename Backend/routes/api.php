<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\InstituteController;
use App\Http\Controllers\LocationController;
use App\Http\Middleware\JwtMiddleware;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ReferenceController;
use App\Http\Controllers\RegistrationController;
use App\Http\Controllers\ReviewController;
use App\Http\Controllers\ServiceController;
use App\Http\Controllers\WorkflowController;

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
            Route::patch('/profile', [AuthController::class , 'updateFullProfile']);
            Route::post('/qualification', [AuthController::class , 'addQualification']);
            Route::post('/registration', [RegistrationController::class , 'submit']);
            Route::get('/applications/pending-with-reminders', [WorkflowController::class, 'pendingWithReminders']);

            // Secure file access
            Route::get('/files/{id}', [App\Http\Controllers\FileController::class, 'show']);

            // ── Review / Approval workflow ────────────────────────────────
            Route::prefix('review')->group(function () {
                Route::get('/applications',                [WorkflowController::class, 'index']);
                Route::get('/my-application',              [WorkflowController::class, 'myApplication']);
                Route::post('/applications/{id}/decide',   [WorkflowController::class, 'decide']);
                // Modal data endpoints
                Route::get('/services',                    [ServiceController::class, 'servicesWithSubservices']);
                Route::get('/staff/{roleSlug}',            [WorkflowController::class, 'staffByRole']);
                Route::get('/applicant/{userId}',          [WorkflowController::class, 'applicantProfile']);
            });

            // ── Admin-only routes ─────────────────────────────────────────
            Route::prefix('admin')->group(function () {
                // Applications
                Route::get('/applications',                    [\App\Http\Controllers\AdminController::class, 'allApplications']);
                Route::get('/applications/{id}/logs',          [\App\Http\Controllers\AdminController::class, 'applicationLogs']);
                Route::get('/applications/{id}/tracker',       [\App\Http\Controllers\AdminController::class, 'applicationTracker']);

                // Institutes
                Route::get('/institutes',                      [\App\Http\Controllers\AdminController::class, 'institutes']);
                Route::post('/institutes',                     [\App\Http\Controllers\AdminController::class, 'createInstitute']);
                Route::patch('/institutes/{id}/approve',       [\App\Http\Controllers\AdminController::class, 'approveInstitute']);
                Route::patch('/institutes/{id}/toggle-status', [\App\Http\Controllers\AdminController::class, 'toggleInstituteStatus']);
                Route::patch('/institutes/{id}',               [\App\Http\Controllers\AdminController::class, 'updateInstitute']);
                Route::delete('/institutes/{id}',              [\App\Http\Controllers\AdminController::class, 'deleteInstitute']);

                // Users & Roles
                Route::get('/roles',                           [\App\Http\Controllers\AdminController::class, 'roles']);
                Route::post('/roles',                          [\App\Http\Controllers\AdminController::class, 'storeRole']);
                Route::patch('/roles/{id}',                    [\App\Http\Controllers\AdminController::class, 'updateRole']);
                Route::post('/users/assign-role',              [\App\Http\Controllers\AdminController::class, 'assignRole']);

                // Systems, Categories, etc.
                Route::post('/categories',                     [\App\Http\Controllers\AdminController::class, 'storeCategory']);
                Route::patch('/categories/{id}/toggle',        [\App\Http\Controllers\AdminController::class, 'toggleCategoryStatus']);

                // Modify Data — generic CRUD listing
                Route::get('/data/{entity}',                   [\App\Http\Controllers\AdminController::class, 'listEntity']);

                // Full workflow pipeline (with steps)
                Route::get('/workflows-full',                  [\App\Http\Controllers\AdminController::class, 'workflowsWithSteps']);
            });
        });
    });