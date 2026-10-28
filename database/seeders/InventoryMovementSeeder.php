<?php

namespace Database\Seeders;

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\PurchaseReceipt;
use App\Models\User;
use Illuminate\Database\Seeder;

class InventoryMovementSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::query()->first();
        $receipt = PurchaseReceipt::query()->where('receipt_number', 'PR-1001')->first();
        $products = Product::query()->get();

        if (! $user || $products->isEmpty()) {
            return;
        }

        foreach ($products as $index => $product) {
            InventoryMovement::query()->create([
                'product_id' => $product->id,
                'movement_type' => 'inbound',
                'quantity_delta' => 20 + $index * 5,
                'reference_type' => $receipt ? 'purchase_receipt' : null,
                'reference_id' => $receipt?->id,
                'reason' => 'Stock replenishment',
                'created_by' => $user->id,
                'created_at' => now(),
            ]);
        }
    }
}
