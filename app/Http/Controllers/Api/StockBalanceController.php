<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockBalance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StockBalanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        return response()->json(
            StockBalance::query()
                ->with('product')
                ->orderByDesc('product_id')
                ->paginate($filters['per_page'] ?? 15)
                ->withQueryString()
        );
    }

    public function show(int $id): JsonResponse
    {
        $product = Product::query()->findOrFail($id);
        $balance = StockBalance::query()->find($product->id);

        return response()->json([
            'product_id' => $product->id,
            'quantity_on_hand' => $balance?->quantity_on_hand ?? 0,
            'updated_at' => $balance?->updated_at,
            'product' => $product,
        ]);
    }
}
