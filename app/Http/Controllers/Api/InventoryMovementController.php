<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryMovement;
use App\Services\InventoryService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InventoryMovementController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'product_id' => ['sometimes', 'integer', 'exists:products,id'],
            'movement_type' => ['sometimes', 'in:inbound,outbound,adjustment'],
            'user_id' => ['sometimes', 'integer', 'exists:users,id'],
            'from' => ['sometimes', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'date_format:Y-m-d', 'after_or_equal:from'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $query = InventoryMovement::query()->with(['product', 'creator', 'reference']);

        foreach (['product_id', 'movement_type'] as $filter) {
            if (isset($filters[$filter])) {
                $query->where($filter, $filters[$filter]);
            }
        }
        if (isset($filters['user_id'])) {
            $query->where('created_by', $filters['user_id']);
        }
        if (isset($filters['from'])) {
            $query->where('created_at', '>=', CarbonImmutable::parse($filters['from'])->startOfDay());
        }
        if (isset($filters['to'])) {
            $query->where('created_at', '<', CarbonImmutable::parse($filters['to'])->addDay()->startOfDay());
        }

        return response()->json(
            $query->orderByDesc('created_at')
                ->orderByDesc('id')
                ->paginate($filters['per_page'] ?? 15)
                ->withQueryString()
        );
    }

    public function store(Request $request, InventoryService $inventory): JsonResponse
    {
        $data = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'movement_type' => ['required', 'in:inbound,outbound,adjustment'],
            'quantity_delta' => ['required', 'integer', 'not_in:0'],
            'reference_type' => ['nullable', 'required_with:reference_id', Rule::in(['order', 'purchase_receipt'])],
            'reference_id' => ['nullable', 'required_with:reference_type', 'integer', 'min:1'],
            'reason' => ['required_if:movement_type,adjustment', 'nullable', 'string', 'max:1000'],
        ]);

        return response()->json(
            $inventory->recordMovement($data, (int) $request->user()->id)->load('reference'),
            201
        );
    }
}
