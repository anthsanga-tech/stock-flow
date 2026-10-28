<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InventoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'category_id' => ['sometimes', 'nullable', 'integer', 'exists:categories,id'],
            'status' => ['sometimes', Rule::in(['all', 'in_stock', 'low_stock', 'out_of_stock'])],
            'sort_by' => ['sometimes', Rule::in(['name', 'sku', 'quantity_on_hand', 'reorder_level'])],
            'sort_direction' => ['sometimes', Rule::in(['asc', 'desc'])],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Product::query()
            ->leftJoin('stock_balances', 'products.id', '=', 'stock_balances.product_id')
            ->select('products.*')
            ->with(['category', 'stockBalance'])
            ->where('products.is_active', true);

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($query) use ($search): void {
                $query->where('products.sku', 'like', "%{$search}%")
                    ->orWhere('products.name', 'like', "%{$search}%");
            });
        }

        if (! empty($filters['category_id'])) {
            $query->where('products.category_id', $filters['category_id']);
        }

        match ($filters['status'] ?? 'all') {
            'in_stock' => $query->whereRaw('COALESCE(stock_balances.quantity_on_hand, 0) > products.reorder_level'),
            'low_stock' => $query->whereRaw('COALESCE(stock_balances.quantity_on_hand, 0) <= products.reorder_level'),
            'out_of_stock' => $query->whereRaw('COALESCE(stock_balances.quantity_on_hand, 0) <= 0'),
            default => null,
        };

        $sortBy = $filters['sort_by'] ?? 'name';
        $sortDirection = $filters['sort_direction'] ?? 'asc';
        if ($sortBy === 'quantity_on_hand') {
            $query->orderByRaw("COALESCE(stock_balances.quantity_on_hand, 0) {$sortDirection}");
        } else {
            $query->orderBy("products.{$sortBy}", $sortDirection);
        }

        $products = $query->orderBy('products.id')->paginate($filters['per_page'] ?? 15)->withQueryString();
        $activeProducts = Product::query()
            ->leftJoin('stock_balances', 'products.id', '=', 'stock_balances.product_id')
            ->where('products.is_active', true);

        $products->setCollection(
            $products->getCollection()->each(function (Product $product): void {
                $product->setAttribute('quantity_on_hand', $product->stockBalance?->quantity_on_hand ?? 0);
            })
        );

        return response()->json([
            ...$products->toArray(),
            'active_products_count' => (clone $activeProducts)->count(),
            'low_stock_count' => (clone $activeProducts)
                ->whereRaw('COALESCE(stock_balances.quantity_on_hand, 0) <= products.reorder_level')
                ->count(),
        ]);
    }

    public function lowStock(Request $request): JsonResponse
    {
        $request->merge(['status' => 'low_stock']);

        return $this->index($request);
    }
}
