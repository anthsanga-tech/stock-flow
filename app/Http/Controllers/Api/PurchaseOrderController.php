<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Services\PurchaseOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PurchaseOrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'supplier_id' => ['sometimes', 'integer', 'exists:suppliers,id'],
            'status' => ['sometimes', Rule::in(['draft', 'submitted', 'approved', 'partially_received', 'received', 'cancelled'])],
            'order_from' => ['sometimes', 'date_format:Y-m-d'],
            'order_to' => ['sometimes', 'date_format:Y-m-d'],
            'expected_from' => ['sometimes', 'date_format:Y-m-d'],
            'expected_to' => ['sometimes', 'date_format:Y-m-d'],
            'sort_by' => ['sometimes', Rule::in(['order_number', 'order_date', 'expected_delivery_date', 'total', 'status', 'id'])],
            'sort_direction' => ['sometimes', Rule::in(['asc', 'desc'])],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);
        foreach ([['order_from', 'order_to'], ['expected_from', 'expected_to']] as [$start, $end]) {
            if (isset($filters[$start], $filters[$end]) && $filters[$end] < $filters[$start]) {
                throw ValidationException::withMessages([
                    $end => ["The {$end} date must be on or after {$start}."],
                ]);
            }
        }

        $query = PurchaseOrder::query()->with(['supplier'])->withCount('items');
        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($query) use ($search): void {
                $query->where('order_number', 'like', "%{$search}%")
                    ->orWhereHas('supplier', fn ($supplier) => $supplier
                        ->where('name', 'like', "%{$search}%")
                        ->orWhere('supplier_code', 'like', "%{$search}%"));
            });
        }
        foreach (['supplier_id', 'status'] as $field) {
            if (isset($filters[$field])) {
                $query->where($field, $filters[$field]);
            }
        }
        if (isset($filters['order_from'])) {
            $query->whereDate('order_date', '>=', $filters['order_from']);
        }
        if (isset($filters['order_to'])) {
            $query->whereDate('order_date', '<=', $filters['order_to']);
        }
        if (isset($filters['expected_from'])) {
            $query->whereDate('expected_delivery_date', '>=', $filters['expected_from']);
        }
        if (isset($filters['expected_to'])) {
            $query->whereDate('expected_delivery_date', '<=', $filters['expected_to']);
        }

        return response()->json(
            $query->orderBy($filters['sort_by'] ?? 'id', $filters['sort_direction'] ?? 'desc')
                ->paginate($filters['per_page'] ?? 15)->withQueryString()
        );
    }

    public function store(Request $request, PurchaseOrderService $orders): JsonResponse
    {
        $data = $request->validate($this->rules());
        $this->validateExpectedDate($data['expected_delivery_date'] ?? null, $data['order_date']);
        $order = $orders->saveDraft(null, $data, (int) $request->user()->id);

        return response()->json($order, 201);
    }

    public function show(PurchaseOrder $purchaseOrder): JsonResponse
    {
        return response()->json($purchaseOrder->load([
            'supplier',
            'items.product:id,sku,name',
            'creator',
            'statusHistory.changer',
            'receipts.items',
            'receipts.creator',
        ]));
    }

    public function update(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $orders): JsonResponse
    {
        $data = $request->validate($this->rules($purchaseOrder));
        $this->validateExpectedDate(
            $data['expected_delivery_date'] ?? $purchaseOrder->expected_delivery_date?->toDateString(),
            $data['order_date'] ?? $purchaseOrder->order_date->toDateString(),
        );

        return response()->json($orders->saveDraft($purchaseOrder, $data, (int) $request->user()->id));
    }

    public function submit(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $orders): JsonResponse
    {
        return response()->json($orders->transition($purchaseOrder, 'submit', (int) $request->user()->id));
    }

    public function approve(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $orders): JsonResponse
    {
        return response()->json($orders->transition($purchaseOrder, 'approve', (int) $request->user()->id));
    }

    public function cancel(Request $request, PurchaseOrder $purchaseOrder, PurchaseOrderService $orders): JsonResponse
    {
        return response()->json($orders->transition($purchaseOrder, 'cancel', (int) $request->user()->id));
    }

    private function rules(?PurchaseOrder $order = null): array
    {
        return [
            'supplier_id' => [...($order === null ? ['required'] : ['sometimes']), 'integer', 'exists:suppliers,id'],
            'order_date' => [...($order === null ? ['required'] : ['sometimes']), 'date_format:Y-m-d'],
            'expected_delivery_date' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'items' => [$order === null ? 'required' : 'sometimes', 'array', 'min:1', 'max:100'],
            'items.*.product_id' => ['required_with:items', 'integer', 'distinct', 'exists:products,id'],
            'items.*.quantity' => ['required_with:items', 'integer', 'min:1', 'max:1000000'],
            'items.*.unit_cost' => ['required_with:items', 'numeric', 'min:0.01', 'max:9999999999.99', 'decimal:0,2'],
        ];
    }

    private function validateExpectedDate(?string $expectedDate, string $orderDate): void
    {
        if ($expectedDate !== null && $expectedDate < $orderDate) {
            throw ValidationException::withMessages([
                'expected_delivery_date' => ['The expected delivery date must be on or after the order date.'],
            ]);
        }
    }
}
