<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Supplier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SupplierController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'sort_by' => ['sometimes', Rule::in(['supplier_code', 'name', 'created_at', 'id'])],
            'sort_direction' => ['sometimes', Rule::in(['asc', 'desc'])],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Supplier::query()->withCount('purchaseOrders');

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($query) use ($search): void {
                $query->where('name', 'like', "%{$search}%")
                    ->orWhere('supplier_code', 'like', "%{$search}%")
                    ->orWhere('contact_person', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if (isset($filters['status'])) {
            $query->where('is_active', $filters['status'] === 'active');
        }

        return response()->json(
            $query->orderBy($filters['sort_by'] ?? 'name', $filters['sort_direction'] ?? 'asc')
                ->paginate($filters['per_page'] ?? 15)
                ->withQueryString()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());
        $supplier = Supplier::query()->create($data);

        return response()->json($supplier->loadCount('purchaseOrders'), 201);
    }

    public function show(Supplier $supplier): JsonResponse
    {
        return response()->json(
            $supplier->loadCount([
                'purchaseOrders',
                'purchaseOrders as outstanding_purchase_orders_count' => fn ($query) => $query
                    ->whereIn('status', ['submitted', 'approved', 'partially_received']),
            ])
        );
    }

    public function purchaseOrders(Request $request, Supplier $supplier): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['sometimes', Rule::in(['draft', 'submitted', 'approved', 'partially_received', 'received', 'cancelled'])],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);
        $query = $supplier->purchaseOrders()->with('supplier')->withCount('items');
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return response()->json(
            $query->orderByDesc('order_date')->orderByDesc('id')
                ->paginate($filters['per_page'] ?? 10)->withQueryString()
        );
    }

    public function update(Request $request, Supplier $supplier): JsonResponse
    {
        $supplier->update($request->validate($this->rules($supplier)));

        return response()->json($supplier->refresh()->loadCount('purchaseOrders'));
    }

    public function destroy(Supplier $supplier): JsonResponse
    {
        $supplier->update(['is_active' => false]);

        return response()->json($supplier->refresh()->loadCount('purchaseOrders'));
    }

    private function rules(?Supplier $supplier = null): array
    {
        return [
            'supplier_code' => [
                ...($supplier === null ? ['required'] : ['sometimes', 'required']),
                'string',
                'max:50',
                Rule::unique('suppliers', 'supplier_code')->ignore($supplier?->id),
            ],
            'name' => [...($supplier === null ? ['required'] : ['sometimes', 'required']), 'string', 'max:255'],
            'contact_person' => ['sometimes', 'nullable', 'string', 'max:255'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:255'],
            'address' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
