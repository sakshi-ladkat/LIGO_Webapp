<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\RegistrationController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "web" middleware group. Make something great!
|
*/

Route::get('/', function () {
    return view('welcome');
});

// Unified Password Management Routes
// Mode: 'setup' (New Account) or 'reset' (Forgot Password)

// 1. Show Form
Route::get('/setup-password', [RegistrationController::class, 'showPasswordForm'])->defaults('mode', 'setup')->name('password.setup');
Route::get('/password/reset', [RegistrationController::class, 'showPasswordForm'])->defaults('mode', 'reset')->name('password.reset');

// 2. Process Form
Route::post('/setup-password', [RegistrationController::class, 'processPassword'])->defaults('mode', 'setup')->name('password.store');
Route::post('/password/reset', [RegistrationController::class, 'processPassword'])->defaults('mode', 'reset')->name('password.update');
