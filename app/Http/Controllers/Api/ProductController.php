<?php

namespace App\Http\Controllers\Api;

use App\Models\Product;
use App\Services\ApiResourceService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProductController extends ApiResourceController
{
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
        ];
    }
}
