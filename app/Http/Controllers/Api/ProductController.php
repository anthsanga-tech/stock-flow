<?php

namespace App\Http\Controllers\Api;

use App\Models\Product;
use App\Models\StockBalance;
use App\Services\ApiResourceService;
use App\Services\InventoryService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProductController extends ApiResourceController
{
    public function __construct(private readonly InventoryService $inventory) {}

    protected function modelClass(): string
    {
        return Product::class;
    }

    protected function relations(): array
    {
        return ['category', 'stockBalance'];
    }

    public function index(Request $request, ApiResourceService $service): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'category_id' => ['sometimes', 'nullable', 'integer', 'exists:categories,id'],
            'is_active' => ['sometimes', 'nullable', 'boolean'],
            'sort_by' => ['sometimes', Rule::in(['sku', 'name', 'cost_price', 'selling_price', 'reorder_level', 'id'])],
            'sort_direction' => ['sometimes', Rule::in(['asc', 'desc'])],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Product::query()->with($this->relations());

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($query) use ($search): void {
                $query->where('sku', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%");
            });
        }

        if (! empty($filters['category_id'])) {
            $query->where('category_id', $filters['category_id']);
        }

        if (array_key_exists('is_active', $filters) && $filters['is_active'] !== null) {
            $query->where('is_active', $filters['is_active']);
        }

        $sortBy = $filters['sort_by'] ?? 'id';
        $sortDirection = $filters['sort_direction'] ?? 'desc';

        return response()->json(
            $query->orderBy($sortBy, $sortDirection)
                ->paginate($filters['per_page'] ?? 15)
                ->withQueryString()
        );
    }

    public function store(Request $request, ApiResourceService $service): JsonResponse
    {
        $data = $request->validate($this->rules());
        $initialStock = (int) ($data['initial_stock'] ?? 0);
        unset($data['initial_stock']);

        $product = DB::transaction(function () use ($data, $initialStock, $request, $service): Product {
            $product = $service->create(
                $this->modelClass(),
                $this->prepareForWrite($data),
                $this->relations(),
            );

            if ($initialStock > 0) {
                $this->inventory->recordMovement([
                    'product_id' => $product->id,
                    'movement_type' => 'inbound',
                    'quantity_delta' => $initialStock,
                    'reason' => 'Initial stock',
                ], (int) $request->user()->id);
            } else {
                StockBalance::query()->create([
                    'product_id' => $product->id,
                    'quantity_on_hand' => 0,
                    'updated_at' => now(),
                ]);
            }

            return $product->load($this->relations());
        });

        return response()->json($product, 201);
    }

    public function update(Request $request, int $id, ApiResourceService $service): JsonResponse
    {
        return DB::transaction(function () use ($request, $id, $service): JsonResponse {
            $product = Product::query()->lockForUpdate()->findOrFail($id);
            $data = $request->validate($this->rules($product));

            if (array_key_exists('is_active', $data) && ! (bool) $data['is_active']) {
                if ($product->purchaseOrderItems()
                    ->whereColumn('purchase_order_items.received_quantity', '<', 'purchase_order_items.quantity')
                    ->whereHas('purchaseOrder', fn ($query) => $query->whereNotIn('status', ['received', 'cancelled']))
                    ->exists()) {
                    throw ValidationException::withMessages([
                        'is_active' => ['Products with outstanding purchase orders cannot be archived until those orders are completed or cancelled.'],
                    ]);
                }

                if ($product->stockReservations()->where('status', 'reserved')->exists()) {
                    throw ValidationException::withMessages([
                        'is_active' => ['Products with active sales-order reservations cannot be archived until those orders are fulfilled or cancelled.'],
                    ]);
                }
            }

            return parent::update($request, $id, $service);
        });
    }

    public function destroy(int $id, ApiResourceService $service): JsonResponse
    {
        $product = Product::query()->findOrFail($id);
        if ($product->orderItems()->exists()) {
            throw ValidationException::withMessages([
                'product' => ['Products referenced by sales-order history cannot be deleted. Archive the product instead.'],
            ]);
        }

        return parent::destroy($id, $service);
    }

    protected function rules(?Model $model = null): array
    {
        return [
            'sku' => [...$this->requiredOnCreate($model, 'string|max:255'), Rule::unique('products', 'sku')->ignore($model?->getKey())],
            'name' => $this->requiredOnCreate($model, 'string|max:255'),
            'category_id' => $this->requiredOnCreate($model, 'integer|exists:categories,id'),
            'unit' => $this->requiredOnCreate($model, 'string|max:100'),
            'cost_price' => $this->requiredOnCreate($model, 'numeric|min:0'),
            'selling_price' => $this->requiredOnCreate($model, 'numeric|min:0'),
            'reorder_level' => $this->requiredOnCreate($model, 'integer|min:0'),
            'is_active' => $this->optionalOnUpdate($model, 'boolean'),
            'initial_stock' => $model === null ? ['sometimes', 'integer', 'min:0'] : ['prohibited'],
        ];
    }
}
