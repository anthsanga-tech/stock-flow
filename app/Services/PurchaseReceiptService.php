<?php

namespace App\Services;

use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\PurchaseOrderStatusHistory;
use App\Models\PurchaseReceipt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PurchaseReceiptService
{
    public function __construct(private readonly InventoryService $inventory) {}

    /**
     * @return array{receipt: PurchaseReceipt, created: bool}
     */
    public function receive(PurchaseOrder $purchaseOrder, array $data, int $userId): array
    {
        $requestHash = hash('sha256', json_encode([
            'received_at' => $data['received_at'],
            'delivery_reference' => $data['delivery_reference'] ?? null,
            'notes' => $data['notes'] ?? null,
            'items' => collect($data['items'])->sortBy('purchase_order_item_id')->values()->all(),
        ], JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($purchaseOrder, $data, $userId, $requestHash): array {
            $order = PurchaseOrder::query()->lockForUpdate()->findOrFail($purchaseOrder->id);
            $existing = PurchaseReceipt::query()
                ->where('idempotency_key', $data['idempotency_key'])
                ->first();

            if ($existing) {
                if ($existing->purchase_order_id !== $order->id || $existing->request_hash !== $requestHash) {
                    abort(409, 'This idempotency key was already used for a different receipt request.');
                }

                return ['receipt' => $this->loadReceipt($existing), 'created' => false];
            }

            if (! in_array($order->status, ['approved', 'partially_received'], true)) {
                throw ValidationException::withMessages([
                    'purchase_order' => ['Only approved purchase orders with outstanding items can be received.'],
                ]);
            }

            $orderItems = $order->items()->lockForUpdate()->get()->keyBy('id');
            $receiptLines = [];
            foreach ($data['items'] as $index => $line) {
                /** @var PurchaseOrderItem|null $orderItem */
                $orderItem = $orderItems->get((int) $line['purchase_order_item_id']);
                if (! $orderItem) {
                    throw ValidationException::withMessages([
                        "items.{$index}.purchase_order_item_id" => ['The selected item does not belong to this purchase order.'],
                    ]);
                }

                $outstanding = $orderItem->quantity - $orderItem->received_quantity;
                if ($outstanding < 1 || (int) $line['quantity'] > $outstanding) {
                    throw ValidationException::withMessages([
                        "items.{$index}.quantity" => ["The quantity exceeds this item's outstanding quantity ({$outstanding})."],
                    ]);
                }

                $receiptLines[] = [$orderItem, (int) $line['quantity']];
            }

            $receipt = PurchaseReceipt::query()->create([
                'supplier_id' => $order->supplier_id,
                'purchase_order_id' => $order->id,
                'receipt_number' => 'GR-'.Str::upper((string) Str::ulid()),
                'status' => 'received',
                'received_at' => $data['received_at'],
                'delivery_reference' => $data['delivery_reference'] ?? null,
                'notes' => $data['notes'] ?? null,
                'idempotency_key' => $data['idempotency_key'],
                'request_hash' => $requestHash,
                'created_by' => $userId,
            ]);

            foreach ($receiptLines as [$orderItem, $quantity]) {
                $receipt->items()->create([
                    'purchase_order_item_id' => $orderItem->id,
                    'product_id' => $orderItem->product_id,
                    'sku_snapshot' => $orderItem->sku_snapshot,
                    'name_snapshot' => $orderItem->name_snapshot,
                    'quantity' => $quantity,
                    'unit_cost' => $orderItem->unit_cost,
                ]);

                $this->inventory->recordMovement([
                    'product_id' => $orderItem->product_id,
                    'movement_type' => 'inbound',
                    'quantity_delta' => $quantity,
                    'reference_type' => 'purchase_receipt',
                    'reference_id' => $receipt->id,
                    'reason' => 'Purchase order '.$order->order_number.' receipt '.$receipt->receipt_number,
                ], $userId);

                $orderItem->update([
                    'received_quantity' => $orderItem->received_quantity + $quantity,
                ]);
            }

            $order->refresh()->load('items');
            $fullyReceived = $order->items->every(
                fn (PurchaseOrderItem $item): bool => $item->received_quantity >= $item->quantity
            );
            $nextStatus = $fullyReceived ? 'received' : 'partially_received';
            $previousStatus = $order->status;

            $order->update(['status' => $nextStatus]);
            if ($previousStatus !== $nextStatus) {
                PurchaseOrderStatusHistory::query()->create([
                    'purchase_order_id' => $order->id,
                    'from_status' => $previousStatus,
                    'to_status' => $nextStatus,
                    'changed_by' => $userId,
                ]);
            }

            return ['receipt' => $this->loadReceipt($receipt), 'created' => true];
        }, attempts: 3);
    }

    private function loadReceipt(PurchaseReceipt $receipt): PurchaseReceipt
    {
        return $receipt->load([
            'supplier',
            'purchaseOrder',
            'items.product:id,sku,name',
            'items.purchaseOrderItem',
            'creator',
        ]);
    }
}
