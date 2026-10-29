<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\PurchaseReceipt;
use App\Models\PurchaseReceiptItem;
use Illuminate\Database\Seeder;

class PurchaseReceiptItemSeeder extends Seeder
{
    public function run(): void
    {
        $receipt = PurchaseReceipt::query()
            ->where('receipt_number', 'PR-1001')
            ->first();
        $products = Product::query()
            ->orderBy('id')
            ->limit(2)
            ->get();

        if (! $receipt || $products->isEmpty()) {
            return;
        }

        foreach ($products as $index => $product) {
            PurchaseReceiptItem::query()->updateOrCreate(
                ['receipt_id' => $receipt->id, 'product_id' => $product->id],
                [
                    'quantity' => 50 + $index * 10,
                    'unit_cost' => $product->cost_price,
                ]
            );
        }
    }
}
