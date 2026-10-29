<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\PurchaseReceipt;
use App\Services\PurchaseReceiptService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class PurchaseReceiptController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'supplier_id' => ['sometimes', 'integer', 'exists:suppliers,id'],
            'purchase_order_id' => ['sometimes', 'integer', 'exists:purchase_orders,id'],
            'from' => ['sometimes', 'date_format:Y-m-d'],
            'to' => ['sometimes', 'date_format:Y-m-d'],
            'reference' => ['sometimes', 'nullable', 'string', 'max:255'],
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);
        if (isset($filters['from'], $filters['to']) && $filters['to'] < $filters['from']) {
            throw ValidationException::withMessages([
                'to' => ['The to date must be on or after the from date.'],
            ]);
        }

        $query = PurchaseReceipt::query()->with(['supplier', 'purchaseOrder', 'creator'])
            ->withCount('items');
        foreach (['supplier_id', 'purchase_order_id'] as $field) {
            if (isset($filters[$field])) {
                $query->where($field, $filters[$field]);
            }
        }
        if (isset($filters['from'])) {
            $query->where('received_at', '>=', CarbonImmutable::parse($filters['from'])->startOfDay());
        }
        if (isset($filters['to'])) {
            $query->where('received_at', '<', CarbonImmutable::parse($filters['to'])->addDay()->startOfDay());
        }
        if (! empty($filters['reference'])) {
            $query->where('delivery_reference', 'like', '%'.$filters['reference'].'%');
        }
        if (! empty($filters['search'])) {
            $query->where(function ($query) use ($filters): void {
                $query->where('receipt_number', 'like', '%'.$filters['search'].'%')
                    ->orWhere('delivery_reference', 'like', '%'.$filters['search'].'%');
            });
        }

        return response()->json(
            $query->orderByDesc('received_at')->orderByDesc('id')
                ->paginate($filters['per_page'] ?? 15)->withQueryString()
        );
    }

    public function show(PurchaseReceipt $purchaseReceipt): JsonResponse
    {
        return response()->json($purchaseReceipt->load([
            'supplier',
            'purchaseOrder',
            'items.product:id,sku,name',
            'items.purchaseOrderItem',
            'creator',
        ]));
    }

    public function store(Request $request, PurchaseOrder $purchaseOrder, PurchaseReceiptService $receipts): JsonResponse
    {
        $data = $request->validate([
            'idempotency_key' => ['required', 'uuid'],
            'received_at' => ['required', 'date_format:Y-m-d'],
            'delivery_reference' => ['sometimes', 'nullable', 'string', 'max:255'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'items' => ['required', 'array', 'min:1', 'max:100'],
            'items.*.purchase_order_item_id' => ['required', 'integer', 'distinct', 'exists:purchase_order_items,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:1000000'],
        ]);
        $result = $receipts->receive($purchaseOrder, $data, (int) $request->user()->id);

        return response()->json($result['receipt'], $result['created'] ? 201 : 200);
    }
}
