<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Services\SalesOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    public function products(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);
        $query = Product::query()
            ->where('is_active', true)
            ->with('stockBalance')
            ->withSum(['stockReservations as reserved_quantity' => fn ($reservations) => $reservations
                ->where('status', 'reserved')], 'reserved_quantity');

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(fn ($products) => $products
                ->where('name', 'like', "%{$search}%")
                ->orWhere('sku', 'like', "%{$search}%"));
        }

        $page = $query->orderBy('name')->paginate($filters['per_page'] ?? 100);
        $page->getCollection()->transform(function (Product $product): array {
            $onHand = $product->stockBalance?->quantity_on_hand ?? 0;
            $reserved = (int) ($product->reserved_quantity ?? 0);

            return [
                'id' => $product->id,
                'sku' => $product->sku,
                'name' => $product->name,
                'selling_price' => $product->selling_price,
                'stock_on_hand' => $onHand,
                'reserved_quantity' => $reserved,
                'available_quantity' => max(0, $onHand - $reserved),
            ];
        });

        return response()->json($page);
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'customer_id' => ['sometimes', 'integer', 'exists:customers,id'],
            'status' => ['sometimes', Rule::in(['draft', 'confirmed', 'processing', 'completed', 'cancelled'])],
            'order_from' => ['sometimes', 'date'],
            'order_to' => ['sometimes', 'date', 'after_or_equal:order_from'],
            'sort_by' => ['sometimes', Rule::in(['order_number', 'order_date', 'expected_delivery_date', 'total', 'status', 'created_at', 'id'])],
            'sort_direction' => ['sometimes', Rule::in(['asc', 'desc'])],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Order::query()->with(['customer', 'creator'])->withCount('items');
        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(fn ($orders) => $orders
                ->where('order_number', 'like', "%{$search}%")
                ->orWhereHas('customer', fn ($customers) => $customers
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('customer_code', 'like', "%{$search}%")
                    ->orWhere('company_name', 'like', "%{$search}%")));
        }
        if (isset($filters['customer_id'])) {
            $query->where('customer_id', $filters['customer_id']);
        }
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (isset($filters['order_from'])) {
            $query->whereDate('order_date', '>=', $filters['order_from']);
        }
        if (isset($filters['order_to'])) {
            $query->whereDate('order_date', '<=', $filters['order_to']);
        }

        return response()->json(
            $query->orderBy($filters['sort_by'] ?? 'order_date', $filters['sort_direction'] ?? 'desc')
                ->orderByDesc('id')
                ->paginate($filters['per_page'] ?? 15)
                ->withQueryString()
        );
    }

    public function store(Request $request, SalesOrderService $service): JsonResponse
    {
        $order = $service->saveDraft(null, $request->validate($this->rules()), (int) $request->user()->id);

        return response()->json($order, 201);
    }

    public function show(Order $order): JsonResponse
    {
        return response()->json($order->load([
            'customer',
            'creator',
            'items.product:id,sku,name,selling_price',
            'items.product.stockBalance',
            'items.reservation',
            'statusHistory.changer',
            'reservations.product',
        ]));
    }

    public function update(Request $request, Order $order, SalesOrderService $service): JsonResponse
    {
        return response()->json(
            $service->saveDraft($order, $request->validate($this->rules($order)), (int) $request->user()->id)
        );
    }

    public function confirm(Request $request, Order $order, SalesOrderService $service): JsonResponse
    {
        return response()->json($service->transition($order, 'confirm', (int) $request->user()->id));
    }

    public function process(Request $request, Order $order, SalesOrderService $service): JsonResponse
    {
        return response()->json($service->transition($order, 'process', (int) $request->user()->id));
    }

    public function complete(Request $request, Order $order, SalesOrderService $service): JsonResponse
    {
        return response()->json($service->transition($order, 'complete', (int) $request->user()->id));
    }

    public function cancel(Request $request, Order $order, SalesOrderService $service): JsonResponse
    {
        return response()->json($service->transition($order, 'cancel', (int) $request->user()->id));
    }

    private function rules(?Order $order = null): array
    {
        $required = $order === null ? ['required'] : ['sometimes', 'required'];
        $items = $order === null ? ['required', 'array', 'min:1'] : ['sometimes', 'array', 'min:1'];

        return [
            'customer_id' => [...$required, 'integer', 'exists:customers,id'],
            'order_date' => [...$required, 'date'],
            'expected_delivery_date' => [
                'sometimes',
                'nullable',
                'date',
                ...($order === null ? ['after_or_equal:order_date'] : []),
            ],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'discount' => ['sometimes', 'numeric', 'decimal:0,2', 'min:0', 'max:9999999999.99'],
            'discount_amount' => ['sometimes', 'numeric', 'decimal:0,2', 'min:0', 'max:9999999999.99'],
            'tax' => ['sometimes', 'numeric', 'decimal:0,2', 'min:0', 'max:9999999999.99'],
            'items' => $items,
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:2147483647'],
            'items.*.unit_price' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:9999999999.99'],
            'items.*.discount_amount' => ['sometimes', 'numeric', 'decimal:0,2', 'min:0', 'max:9999999999.99'],
        ];
    }
}
