<?php

use App\Http\Controllers\Api\AuditLogController;
use App\Http\Controllers\Api\CategoryController;
use App\Http\Controllers\Api\CustomerController;
use App\Http\Controllers\Api\InventoryMovementController;
use App\Http\Controllers\Api\InventoryController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\OrderItemController;
use App\Http\Controllers\Api\OrderStatusHistoryController;
use App\Http\Controllers\Api\PermissionController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\PurchaseReceiptController;
use App\Http\Controllers\Api\PurchaseOrderController;
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
        Route::get('inventory', [InventoryController::class, 'index'])->name('inventory.index');
        Route::get('inventory/low-stock', [InventoryController::class, 'lowStock'])->name('inventory.low-stock');
        Route::get('inventory-movements', [InventoryMovementController::class, 'index'])->name('inventory-movements.index');
        Route::get('stock-balances', [StockBalanceController::class, 'index'])->name('stock-balances.index');
        Route::get('stock-balances/{id}', [StockBalanceController::class, 'show'])->name('stock-balances.show');
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
    Route::middleware('permission:suppliers.view')->group(function () {
        Route::get('suppliers', [SupplierController::class, 'index'])->name('suppliers.index');
        Route::get('suppliers/{supplier}', [SupplierController::class, 'show'])->name('suppliers.show');
        Route::get('suppliers/{supplier}/purchase-orders', [SupplierController::class, 'purchaseOrders'])->name('suppliers.purchase-orders');
    });
    Route::middleware('permission:suppliers.manage')->group(function () {
        Route::post('suppliers', [SupplierController::class, 'store'])->name('suppliers.store');
        Route::put('suppliers/{supplier}', [SupplierController::class, 'update'])->name('suppliers.update');
        Route::patch('suppliers/{supplier}', [SupplierController::class, 'update'])->name('suppliers.patch');
        Route::delete('suppliers/{supplier}', [SupplierController::class, 'destroy'])->name('suppliers.deactivate');
    });
    Route::apiResource('customers', CustomerController::class);
    Route::post('inventory-movements', [InventoryMovementController::class, 'store'])
        ->middleware('permission:products.manage')
        ->name('inventory-movements.store');
    Route::middleware('permission:suppliers.view')->group(function () {
        Route::get('purchase-orders', [PurchaseOrderController::class, 'index'])->name('purchase-orders.index');
        Route::get('purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'show'])->name('purchase-orders.show');
        Route::get('goods-receipts', [PurchaseReceiptController::class, 'index'])->name('goods-receipts.index');
        Route::get('goods-receipts/{purchaseReceipt}', [PurchaseReceiptController::class, 'show'])->name('goods-receipts.show');
    });
    Route::middleware('permission:suppliers.manage')->group(function () {
        Route::post('purchase-orders', [PurchaseOrderController::class, 'store'])->name('purchase-orders.store');
        Route::put('purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'update'])->name('purchase-orders.update');
        Route::post('purchase-orders/{purchaseOrder}/submit', [PurchaseOrderController::class, 'submit'])->name('purchase-orders.submit');
        Route::post('purchase-orders/{purchaseOrder}/approve', [PurchaseOrderController::class, 'approve'])->name('purchase-orders.approve');
        Route::post('purchase-orders/{purchaseOrder}/cancel', [PurchaseOrderController::class, 'cancel'])->name('purchase-orders.cancel');
        Route::post('purchase-orders/{purchaseOrder}/receipts', [PurchaseReceiptController::class, 'store'])->name('purchase-orders.receipts.store');
    });
    Route::apiResource('orders', OrderController::class);
    Route::apiResource('order-items', OrderItemController::class);
    Route::apiResource('order-status-history', OrderStatusHistoryController::class)
        ->only(['index', 'store', 'show']);
    Route::apiResource('audit-logs', AuditLogController::class)
        ->only(['index', 'store', 'show']);
});
