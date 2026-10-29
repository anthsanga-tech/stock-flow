<?php

namespace App\Services;

use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderStatusHistory;
use App\Models\Supplier;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PurchaseOrderService
{
    private const MAX_TOTAL_CENTS = 999999999999;

    public function saveDraft(?PurchaseOrder $order, array $data, int $userId): PurchaseOrder
    {
        return DB::transaction(function () use ($order, $data, $userId): PurchaseOrder {
            $supplierId = $data['supplier_id'] ?? $order?->supplier_id;
            $supplier = Supplier::query()->lockForUpdate()->findOrFail($supplierId);

            if (! $supplier->is_active && ($order === null || $supplier->id !== $order->supplier_id)) {
                throw ValidationException::withMessages([
                    'supplier_id' => ['Inactive suppliers cannot be selected for new purchase orders.'],
                ]);
            }

            $order = $order
                ? PurchaseOrder::query()->lockForUpdate()->findOrFail($order->id)
                : new PurchaseOrder([
                    'order_number' => 'PO-'.now()->format('Ymd').'-'.Str::upper((string) Str::ulid()),
                    'created_by' => $userId,
                    'status' => 'draft',
                ]);

            if ($order->status !== 'draft') {
                throw ValidationException::withMessages([
                    'status' => ['Only draft purchase orders can be edited.'],
                ]);
            }

            $items = $data['items'] ?? null;
            if ($items === null && $order->exists) {
                $order->fill(collect($data)->except('items')->all())->save();

                return $order->refresh()->load(['supplier', 'items.product:id,sku,name', 'creator']);
            }

            if (! is_array($items) || count($items) < 1) {
                throw ValidationException::withMessages([
                    'items' => ['Add at least one product to the purchase order.'],
                ]);
            }

            $products = Product::query()
                ->whereIn('id', collect($items)->pluck('product_id'))
                ->get()
                ->keyBy('id');
            $subtotalCents = 0;
            $preparedItems = [];

            foreach ($items as $index => $item) {
                $product = $products->get((int) $item['product_id']);
                if (! $product || ! $product->is_active) {
                    throw ValidationException::withMessages([
                        "items.{$index}.product_id" => ['Select an active product.'],
                    ]);
                }

                $unitCostCents = $this->moneyToCents($item['unit_cost']);
                $lineSubtotalCents = $unitCostCents * (int) $item['quantity'];
                if ($lineSubtotalCents > self::MAX_TOTAL_CENTS
                    || $subtotalCents > self::MAX_TOTAL_CENTS - $lineSubtotalCents) {
                    throw ValidationException::withMessages([
                        "items.{$index}.unit_cost" => ['The line or order total exceeds the supported amount.'],
                    ]);
                }

                $subtotalCents += $lineSubtotalCents;
                $preparedItems[] = [
                    'product_id' => $product->id,
                    'sku_snapshot' => $product->sku,
                    'name_snapshot' => $product->name,
                    'quantity' => (int) $item['quantity'],
                    'received_quantity' => 0,
                    'unit_cost' => $this->centsToMoney($unitCostCents),
                    'line_subtotal' => $this->centsToMoney($lineSubtotalCents),
                ];
            }

            $order->fill(collect($data)->except('items')->all());
            $order->supplier_id = $supplier->id;
            $order->subtotal = $this->centsToMoney($subtotalCents);
            $order->total = $order->subtotal;
            $order->save();
            $order->items()->delete();
            $order->items()->createMany($preparedItems);

            if ($order->wasRecentlyCreated) {
                PurchaseOrderStatusHistory::query()->create([
                    'purchase_order_id' => $order->id,
                    'from_status' => null,
                    'to_status' => 'draft',
                    'changed_by' => $userId,
                ]);
            }

            return $order->refresh()->load(['supplier', 'items.product:id,sku,name', 'creator']);
        }, attempts: 3);
    }

    public function transition(PurchaseOrder $order, string $action, int $userId): PurchaseOrder
    {
        return DB::transaction(function () use ($order, $action, $userId): PurchaseOrder {
            $order = PurchaseOrder::query()->lockForUpdate()->findOrFail($order->id);
            $transitions = [
                'submit' => ['draft', 'submitted'],
                'approve' => ['submitted', 'approved'],
                'cancel' => [['draft', 'submitted', 'approved'], 'cancelled'],
            ];
            [$allowed, $next] = $transitions[$action];
            $allowed = is_array($allowed) ? $allowed : [$allowed];

            if (! in_array($order->status, $allowed, true)) {
                $verb = [
                    'submit' => 'submitted',
                    'approve' => 'approved',
                    'cancel' => 'cancelled',
                ][$action];
                throw ValidationException::withMessages([
                    'status' => ["A purchase order with status {$order->status} cannot be {$verb}."],
                ]);
            }

            $previous = $order->status;
            $order->update(['status' => $next]);
            PurchaseOrderStatusHistory::query()->create([
                'purchase_order_id' => $order->id,
                'from_status' => $previous,
                'to_status' => $next,
                'changed_by' => $userId,
            ]);

            return $order->refresh()->load(['supplier', 'items.product:id,sku,name', 'creator', 'statusHistory.changer']);
        }, attempts: 3);
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
