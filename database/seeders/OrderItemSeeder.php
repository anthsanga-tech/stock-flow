<?php

namespace Database\Seeders;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Database\Seeder;

class OrderItemSeeder extends Seeder
{
    public function run(): void
    {
        $order = Order::query()->first();
        $products = Product::query()->limit(2)->get();

        if (! $order || $products->isEmpty()) {
            return;
        }

        foreach ($products as $index => $product) {
            OrderItem::query()->create([
                'order_id' => $order->id,
                'product_id' => $product->id,
                'sku_snapshot' => $product->sku,
                'name_snapshot' => $product->name,
                'quantity' => 2 + $index,
                'unit_price' => $product->selling_price,
                'line_total' => $product->selling_price * (2 + $index),
            ]);
        }
    }
}
