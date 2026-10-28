<?php

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\InventoryMovementController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\OrderItemController;
use App\Http\Controllers\Api\OrderStatusHistoryController;
use App\Http\Controllers\Api\PermissionController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PurchaseReceiptController;
use App\Http\Controllers\Api\PurchaseReceiptItemController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\RolePermissionController;
use App\Http\Controllers\Api\StockBalanceController;
use App\Http\Controllers\Api\SupplierController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Middleware\EnsureUserIsActive;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:sanctum', EnsureUserIsActive::class])->group(function () {
    Route::get('/user', [AuthenticatedSessionController::class, 'user'])->name('api.user');
    Route::middleware('permission:products.view')->group(function () {
        Route::apiResource('products', ProductController::class)->only(['index', 'show']);
        Route::apiResource('categories', CategoryController::class)->only(['index', 'show']);
    });
    Route::middleware('permission:products.manage')->group(function () {
        Route::apiResource('products', ProductController::class)->only(['store', 'update', 'destroy']);
        Route::apiResource('categories', CategoryController::class)->only(['store', 'update', 'destroy']);
    });
    Route::apiResource('users', UserController::class);
    Route::apiResource('roles', RoleController::class);
    Route::put('roles/{role}/permissions', [RolePermissionController::class, 'update'])
        ->name('roles.permissions.update');
    Route::apiResource('permissions', PermissionController::class);
    Route::apiResource('suppliers', SupplierController::class);
    Route::apiResource('customers', CustomerController::class);
    Route::apiResource('inventory-movements', InventoryMovementController::class)
        ->only(['index', 'store', 'show']);
    Route::apiResource('stock-balances', StockBalanceController::class)
        ->only(['index', 'show']);
    Route::apiResource('purchase-receipts', PurchaseReceiptController::class);
    Route::apiResource('purchase-receipt-items', PurchaseReceiptItemController::class);
    Route::apiResource('orders', OrderController::class);
    Route::apiResource('order-items', OrderItemController::class);
    Route::apiResource('order-status-history', OrderStatusHistoryController::class)
        ->only(['index', 'store', 'show']);
    Route::apiResource('audit-logs', AuditLogController::class)
        ->only(['index', 'store', 'show']);
});
