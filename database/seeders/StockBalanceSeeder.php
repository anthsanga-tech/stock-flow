<?php

namespace Database\Seeders;

use App\Models\Product;
use App\Models\StockBalance;
use Illuminate\Database\Seeder;

class StockBalanceSeeder extends Seeder
{
    public function run(): void
    {
        foreach (Product::query()->get() as $index => $product) {
            StockBalance::query()->updateOrCreate(
                ['product_id' => $product->id],
                [
                    'quantity_on_hand' => 30 + $index * 15,
                    'updated_at' => now(),
                ]
            );
        }
    }
}
