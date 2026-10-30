<?php

namespace App\Services;

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\StockBalance;
use App\Models\StockReservation;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryService
{
    public function recordMovement(array $data, int $userId): InventoryMovement
    {
        return DB::transaction(function () use ($data, $userId): InventoryMovement {
            $product = Product::query()
                ->lockForUpdate()
                ->findOrFail($data['product_id']);

            if (! $product->is_active) {
                throw ValidationException::withMessages([
                    'product_id' => ['Archived products cannot receive stock movements.'],
                ]);
            }

            $delta = filter_var($data['quantity_delta'] ?? null, FILTER_VALIDATE_INT);

            if ($delta === false || $delta === 0) {
                throw ValidationException::withMessages([
                    'quantity_delta' => ['The quantity must be a non-zero whole number.'],
                ]);
            }

            if (($data['movement_type'] === 'inbound' && $delta < 1)
                || ($data['movement_type'] === 'outbound' && $delta > -1)) {
                throw ValidationException::withMessages([
                    'quantity_delta' => ['The quantity sign must match the movement type.'],
                ]);
            }

            $balance = StockBalance::query()
                ->where('product_id', $product->id)
                ->lockForUpdate()
                ->first();
            $quantityBefore = $balance?->quantity_on_hand ?? 0;
            $quantityAfter = $quantityBefore + $delta;

            if ($quantityAfter < 0) {
                throw ValidationException::withMessages([
                    'quantity_delta' => ['The movement cannot reduce stock below zero.'],
                ]);
            }

            if ($delta < 0) {
                $reservedQuantity = (int) StockReservation::query()
                    ->where('product_id', $product->id)
                    ->where('status', 'reserved')
                    ->sum('reserved_quantity');

                if ($quantityAfter < $reservedQuantity) {
                    throw ValidationException::withMessages([
                        'quantity_delta' => ['This movement would consume stock reserved for sales orders.'],
                    ]);
                }
            }

            if ($balance) {
                $balance->update([
                    'quantity_on_hand' => $quantityAfter,
                    'updated_at' => now(),
                ]);
            } else {
                $balance = StockBalance::query()->create([
                    'product_id' => $product->id,
                    'quantity_on_hand' => $quantityAfter,
                    'updated_at' => now(),
                ]);
            }

            return InventoryMovement::query()->create([
                'product_id' => $product->id,
                'movement_type' => $data['movement_type'],
                'quantity_delta' => $delta,
                'quantity_before' => $quantityBefore,
                'quantity_after' => $quantityAfter,
                'reference_type' => $data['reference_type'] ?? null,
                'reference_id' => $data['reference_id'] ?? null,
                'reason' => $data['reason'] ?? null,
                'created_by' => $userId,
                'created_at' => now(),
            ])->load(['product', 'creator']);
        }, attempts: 3);
    }
}
