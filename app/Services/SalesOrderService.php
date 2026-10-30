<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\StockBalance;
use App\Models\StockReservation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SalesOrderService
{
    private const MAX_TOTAL_CENTS = 999999999999;

    public function __construct(private readonly InventoryService $inventory) {}

    public function saveDraft(?Order $order, array $data, int $userId): Order
    {
        return DB::transaction(function () use ($order, $data, $userId): Order {
            $order = $order
                ? Order::query()->lockForUpdate()->findOrFail($order->id)
                : new Order([
                    'order_number' => 'SO-'.now()->format('Ymd').'-'.Str::upper((string) Str::ulid()),
                    'created_by' => $userId,
                    'status' => 'draft',
                    'order_date' => now()->toDateString(),
                    'created_at' => now(),
                ]);

            $customerId = $data['customer_id'] ?? $order->customer_id;
            $customer = Customer::query()->lockForUpdate()->findOrFail($customerId);
            if ($customer->status !== 'active') {
                throw ValidationException::withMessages([
                    'customer_id' => ['Select an active customer for a sales order.'],
                ]);
            }

            if ($order->status !== 'draft') {
                throw ValidationException::withMessages([
                    'status' => ['Only draft sales orders can be edited.'],
                ]);
            }

            $effectiveOrderDate = $data['order_date'] ?? $order->order_date?->toDateString();
            $effectiveExpectedDate = $data['expected_delivery_date'] ?? $order->expected_delivery_date?->toDateString();
            if ($effectiveExpectedDate && $effectiveOrderDate && $effectiveExpectedDate < $effectiveOrderDate) {
                throw ValidationException::withMessages([
                    'expected_delivery_date' => ['The expected delivery date must be on or after the order date.'],
                ]);
            }

            $items = $data['items'] ?? null;
            if ($items === null && $order->exists) {
                $subtotalCents = $this->moneyToCents($order->subtotal);
                $orderDiscountCents = $this->moneyToCents(
                    $data['discount_amount'] ?? $data['discount'] ?? $order->discount
                );
                $taxCents = $this->moneyToCents($data['tax'] ?? $order->tax);
                if ($orderDiscountCents > $subtotalCents) {
                    throw ValidationException::withMessages([
                        'discount_amount' => ['The order discount cannot exceed the order subtotal.'],
                    ]);
                }
                $totalCents = $subtotalCents - $orderDiscountCents + $taxCents;
                if ($totalCents > self::MAX_TOTAL_CENTS) {
                    throw ValidationException::withMessages([
                        'tax' => ['The order total exceeds the supported amount.'],
                    ]);
                }

                $order->fill(collect($data)->except(['items', 'discount_amount'])->all());
                $order->customer_id = $customer->id;
                $order->subtotal = $this->centsToMoney($subtotalCents);
                $order->discount = $this->centsToMoney($orderDiscountCents);
                $order->tax = $this->centsToMoney($taxCents);
                $order->total = $this->centsToMoney($totalCents);
                $order->updated_at = now();
                $order->save();

                return $this->loadOrder($order);
            }

            if (! is_array($items) || count($items) < 1) {
                throw ValidationException::withMessages([
                    'items' => ['Add at least one product to the sales order.'],
                ]);
            }

            $products = Product::query()
                ->whereIn('id', collect($items)->pluck('product_id')->unique())
                ->get()
                ->keyBy('id');
            $preparedItems = [];
            $subtotalCents = 0;

            foreach ($items as $index => $item) {
                $product = $products->get((int) $item['product_id']);
                if (! $product || ! $product->is_active) {
                    throw ValidationException::withMessages([
                        "items.{$index}.product_id" => ['Select an active product.'],
                    ]);
                }

                $unitPriceCents = $this->moneyToCents($item['unit_price'] ?? $product->selling_price);
                $discountCents = $this->moneyToCents($item['discount_amount'] ?? 0);
                $grossCents = $unitPriceCents * (int) $item['quantity'];
                if ($grossCents > self::MAX_TOTAL_CENTS || $discountCents > $grossCents) {
                    throw ValidationException::withMessages([
                        "items.{$index}.discount_amount" => ['The item discount cannot exceed its line subtotal.'],
                    ]);
                }

                $lineTotalCents = $grossCents - $discountCents;
                if ($subtotalCents > self::MAX_TOTAL_CENTS - $lineTotalCents) {
                    throw ValidationException::withMessages([
                        "items.{$index}.quantity" => ['The order total exceeds the supported amount.'],
                    ]);
                }

                $subtotalCents += $lineTotalCents;
                $preparedItems[] = [
                    'product_id' => $product->id,
                    'sku_snapshot' => $product->sku,
                    'name_snapshot' => $product->name,
                    'quantity' => (int) $item['quantity'],
                    'unit_price' => $this->centsToMoney($unitPriceCents),
                    'discount_amount' => $this->centsToMoney($discountCents),
                    'line_total' => $this->centsToMoney($lineTotalCents),
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            $orderDiscount = $this->moneyToCents($data['discount_amount'] ?? $data['discount'] ?? $order->discount ?? 0);
            $taxCents = $this->moneyToCents($data['tax'] ?? $order->tax ?? 0);
            if ($orderDiscount > $subtotalCents) {
                throw ValidationException::withMessages([
                    'discount_amount' => ['The order discount cannot exceed the order subtotal.'],
                ]);
            }

            $totalCents = $subtotalCents - $orderDiscount + $taxCents;
            if ($totalCents > self::MAX_TOTAL_CENTS) {
                throw ValidationException::withMessages([
                    'tax' => ['The order total exceeds the supported amount.'],
                ]);
            }

            $order->fill(collect($data)->except(['items', 'discount_amount'])->all());
            if (array_key_exists('discount_amount', $data)) {
                $order->discount = $this->centsToMoney($orderDiscount);
            }
            $order->customer_id = $customer->id;
            $order->subtotal = $this->centsToMoney($subtotalCents);
            $order->discount = $this->centsToMoney($orderDiscount);
            $order->tax = $this->centsToMoney($taxCents);
            $order->total = $this->centsToMoney($totalCents);
            $order->updated_at = now();
            $order->save();
            $order->items()->delete();
            $order->items()->createMany($preparedItems);

            if ($order->wasRecentlyCreated) {
                $this->recordStatus($order, null, 'draft', $userId);
            }

            return $this->loadOrder($order);
        }, attempts: 3);
    }

    public function transition(Order $order, string $action, int $userId): Order
    {
        return DB::transaction(function () use ($order, $action, $userId): Order {
            $order = Order::query()->lockForUpdate()->findOrFail($order->id);

            $reservedCount = $order->reservations()->where('status', 'reserved')->count();
            if ($action === 'confirm' && $order->status === 'confirmed'
                && $reservedCount > 0 && $reservedCount === $order->items()->count()) {
                return $this->loadOrder($order);
            }
            if ($action === 'process' && $order->status === 'processing') {
                return $this->loadOrder($order);
            }
            if ($action === 'complete' && $order->status === 'completed') {
                return $this->loadOrder($order);
            }
            if ($action === 'cancel' && $order->status === 'cancelled') {
                return $this->loadOrder($order);
            }

            $nextStatus = match ($action) {
                'confirm' => $this->confirm($order),
                'process' => $this->process($order),
                'complete' => $this->complete($order, $userId),
                'cancel' => $this->cancel($order),
                default => throw ValidationException::withMessages(['status' => ['This status action is not supported.']]),
            };

            $previous = $order->status;
            $order->update(['status' => $nextStatus, 'updated_at' => now()]);
            $this->recordStatus($order, $previous, $nextStatus, $userId);

            return $this->loadOrder($order);
        }, attempts: 3);
    }

    private function confirm(Order $order): string
    {
        if ($order->status !== 'draft' || $order->items()->count() === 0) {
            throw ValidationException::withMessages([
                'status' => ['Only a non-empty draft sales order can be confirmed.'],
            ]);
        }

        $customer = Customer::query()->lockForUpdate()->findOrFail($order->customer_id);
        if ($customer->status !== 'active') {
            throw ValidationException::withMessages([
                'customer_id' => ['The order customer must be active when the order is confirmed.'],
            ]);
        }

        $items = $order->items()->orderBy('product_id')->orderBy('id')->get();
        $productIds = $items->pluck('product_id')->unique()->sort()->values();
        $products = Product::query()->whereIn('id', $productIds)->orderBy('id')->lockForUpdate()->get()->keyBy('id');

        foreach ($productIds as $productId) {
            $product = $products->get($productId);
            if (! $product || ! $product->is_active) {
                throw ValidationException::withMessages([
                    'items' => ['All ordered products must remain active when the order is confirmed.'],
                ]);
            }

            $balance = StockBalance::query()->where('product_id', $productId)->lockForUpdate()->first();
            $physical = $balance?->quantity_on_hand ?? 0;
            $reserved = (int) StockReservation::query()
                ->where('product_id', $productId)
                ->where('status', 'reserved')
                ->sum('reserved_quantity');
            $requested = (int) $items->where('product_id', $productId)->sum('quantity');
            $available = $physical - $reserved;

            if ($requested > $available) {
                throw ValidationException::withMessages([
                    'items' => ["Insufficient available stock for {$product->name}: {$available} available, {$requested} requested."],
                ]);
            }
        }

        if ($order->reservations()->exists()) {
            throw ValidationException::withMessages([
                'status' => ['This sales order already has reservation records and cannot be reserved again.'],
            ]);
        }

        foreach ($items as $item) {
            StockReservation::query()->create([
                'sales_order_id' => $order->id,
                'sales_order_item_id' => $item->id,
                'product_id' => $item->product_id,
                'reserved_quantity' => $item->quantity,
                'status' => 'reserved',
            ]);
        }

        return 'confirmed';
    }

    private function process(Order $order): string
    {
        if ($order->status !== 'confirmed'
            || ! $order->reservations()->where('status', 'reserved')->exists()) {
            throw ValidationException::withMessages([
                'status' => ['Only a confirmed order with active stock reservations can be processed.'],
            ]);
        }

        return 'processing';
    }

    private function complete(Order $order, int $userId): string
    {
        if ($order->status !== 'processing') {
            throw ValidationException::withMessages([
                'status' => ['Only a processing sales order can be completed.'],
            ]);
        }

        $reservations = $order->reservations()
            ->where('status', 'reserved')
            ->orderBy('product_id')
            ->lockForUpdate()
            ->get();
        if ($reservations->count() !== $order->items()->count()) {
            throw ValidationException::withMessages([
                'status' => ['The order does not have a complete set of active stock reservations.'],
            ]);
        }

        $productIds = $reservations->pluck('product_id')->unique()->sort()->values();
        Product::query()->whereIn('id', $productIds)->orderBy('id')->lockForUpdate()->get();
        foreach ($productIds as $productId) {
            StockBalance::query()->where('product_id', $productId)->lockForUpdate()->first();
        }

        foreach ($reservations as $reservation) {
            $reservation->update(['status' => 'consumed']);
            $this->inventory->recordMovement([
                'product_id' => $reservation->product_id,
                'movement_type' => 'outbound',
                'quantity_delta' => -$reservation->reserved_quantity,
                'reference_type' => 'order',
                'reference_id' => $order->id,
                'reason' => 'Fulfilled sales order '.$order->order_number,
            ], $userId);
        }

        return 'completed';
    }

    private function cancel(Order $order): string
    {
        if (! in_array($order->status, ['draft', 'confirmed', 'processing'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Only draft, confirmed, or processing orders can be cancelled.'],
            ]);
        }

        $order->reservations()
            ->where('status', 'reserved')
            ->lockForUpdate()
            ->get()
            ->each(fn (StockReservation $reservation) => $reservation->update(['status' => 'released']));

        return 'cancelled';
    }

    private function recordStatus(Order $order, ?string $from, string $to, int $userId): void
    {
        OrderStatusHistory::query()->create([
            'order_id' => $order->id,
            'from_status' => $from,
            'to_status' => $to,
            'changed_by' => $userId,
            'created_at' => now(),
        ]);
    }

    private function loadOrder(Order $order): Order
    {
        return $order->refresh()->load([
            'customer',
            'creator',
            'items.product:id,sku,name,selling_price',
            'items.reservation',
            'statusHistory.changer',
            'reservations',
        ]);
    }

    private function moneyToCents(string|int|float $value): int
    {
        $formatted = number_format((float) $value, 2, '.', '');
        [$whole, $fraction] = explode('.', $formatted);

        return ((int) $whole * 100) + (int) $fraction;
    }

    private function centsToMoney(int $cents): string
    {
        return intdiv($cents, 100).'.'.str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }
}
