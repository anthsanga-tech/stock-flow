<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['sometimes', 'nullable', 'string', 'max:255'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'sort_by' => ['sometimes', Rule::in(['customer_code', 'name', 'company_name', 'created_at', 'updated_at', 'id'])],
            'sort_direction' => ['sometimes', Rule::in(['asc', 'desc'])],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Customer::query()
            ->withCount('orders')
            ->withSum('orders', 'total')
            ->withCount(['orders as outstanding_orders_count' => fn ($orders) => $orders
                ->whereIn('status', ['confirmed', 'processing'])]);

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(fn ($customers) => $customers
                ->where('customer_code', 'like', "%{$search}%")
                ->orWhere('name', 'like', "%{$search}%")
                ->orWhere('company_name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%")
                ->orWhere('phone', 'like', "%{$search}%"));
        }

        if (isset($filters['status'])) {
            $query->where('is_active', $filters['status'] === 'active');
        }

        return response()->json(
            $query->orderBy($filters['sort_by'] ?? 'name', $filters['sort_direction'] ?? 'asc')
                ->orderBy('id')
                ->paginate($filters['per_page'] ?? 15)
                ->withQueryString()
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());
        $status = $data['status'] ?? (isset($data['is_active']) && ! $data['is_active'] ? 'inactive' : 'active');
        unset($data['status'], $data['is_active']);
        $now = now();
        $customer = Customer::query()->create([
            ...$data,
            'customer_code' => 'CUS-'.Str::upper((string) Str::ulid()),
            'status' => $status,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return response()->json($customer->loadCount('orders')->loadSum('orders', 'total'), 201);
    }

    public function show(Customer $customer): JsonResponse
    {
        return response()->json($this->withSummary($customer));
    }

    public function orders(Request $request, Customer $customer): JsonResponse
    {
        $filters = $request->validate([
            'status' => ['sometimes', Rule::in(['draft', 'confirmed', 'processing', 'completed', 'cancelled'])],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);
        $query = $customer->orders()->with('creator')->withCount('items');
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return response()->json(
            $query->orderByDesc('order_date')->orderByDesc('id')
                ->paginate($filters['per_page'] ?? 10)->withQueryString()
        );
    }

    public function update(Request $request, Customer $customer): JsonResponse
    {
        return DB::transaction(function () use ($request, $customer): JsonResponse {
            $customer = Customer::query()->lockForUpdate()->findOrFail($customer->id);
            $data = $request->validate($this->rules($customer));
            if (isset($data['status'])) {
                $customer->status = $data['status'];
                unset($data['status'], $data['is_active']);
            } elseif (isset($data['is_active'])) {
                $customer->status = $data['is_active'] ? 'active' : 'inactive';
                unset($data['is_active']);
            }
            $customer->fill($data);
            $customer->updated_at = now();
            $customer->save();

            return response()->json($this->withSummary($customer->refresh()));
        });
    }

    public function destroy(Customer $customer): JsonResponse
    {
        return DB::transaction(function () use ($customer): JsonResponse {
            $customer = Customer::query()->lockForUpdate()->findOrFail($customer->id);
            if ($customer->orders()->exists()) {
                throw ValidationException::withMessages([
                    'customer' => ['Customers with associated sales orders cannot be deleted. Deactivate the customer instead.'],
                ]);
            }

            $customer->delete();

            return response()->json(null, 204);
        });
    }

    private function withSummary(Customer $customer): Customer
    {
        return $customer->loadCount([
            'orders',
            'orders as outstanding_orders_count' => fn ($orders) => $orders
                ->whereIn('status', ['confirmed', 'processing']),
        ])->loadSum('orders', 'total')
            ->load(['orders' => fn ($orders) => $orders
                ->withCount('items')
                ->orderByDesc('order_date')
                ->limit(10)]);
    }

    private function rules(?Customer $customer = null): array
    {
        $required = $customer === null ? ['required'] : ['sometimes', 'required'];

        return [
            'name' => [...$required, 'string', 'max:255'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:255'],
            'company_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'billing_address' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'shipping_address' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'address' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
