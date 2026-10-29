<?php

namespace Database\Seeders;

use App\Models\InventoryMovement;
use App\Models\PurchaseReceipt;
use App\Models\User;
use App\Services\InventoryService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class InventoryMovementSeeder extends Seeder
{
    public function run(InventoryService $inventory): void
    {
        DB::transaction(function () use ($inventory): void {
            $user = User::query()->first();
            $receipt = PurchaseReceipt::query()
                ->where('receipt_number', 'PR-1001')
                ->lockForUpdate()
                ->first();

            if (! $user || ! $receipt || $receipt->status !== 'received') {
                return;
            }

            foreach ($receipt->items()->orderBy('id')->get() as $item) {
                if (InventoryMovement::query()
                    ->where('product_id', $item->product_id)
                    ->where('reference_type', 'purchase_receipt')
                    ->where('reference_id', $receipt->id)
                    ->exists()) {
                    continue;
                }

                $inventory->recordMovement([
                    'product_id' => $item->product_id,
                    'movement_type' => 'inbound',
                    'quantity_delta' => $item->quantity,
                    'reference_type' => 'purchase_receipt',
                    'reference_id' => $receipt->id,
                    'reason' => 'Stock received against receipt '.$receipt->receipt_number,
                ], $user->id);
            }
        });
    }
}
