<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ConfigController;
use App\Http\Controllers\SyncController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:20,1');
Route::post('/email/verify', [AuthController::class, 'verifyEmail'])->middleware('throttle:10,1');
Route::post('/email/resend', [AuthController::class, 'resendCode'])->middleware('throttle:5,1');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::post('/sync', [SyncController::class, 'sync']);

    Route::get('/config', [ConfigController::class, 'show']);
    Route::put('/config', [ConfigController::class, 'update']);

    Route::get('/admin/settings', [AdminController::class, 'show']);
    Route::put('/admin/settings', [AdminController::class, 'update']);
});
