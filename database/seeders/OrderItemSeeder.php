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
        $order = Order::query()->where('order_number', 'SO-1001')->first();
        $products = Product::query()->limit(2)->get();

        if (! $order || $products->isEmpty()) {
            return;
        }

        foreach ($products as $index => $product) {
            $quantity = 2 + $index;
            OrderItem::query()->updateOrCreate([
                'order_id' => $order->id,
                'product_id' => $product->id,
            ], [
                'sku_snapshot' => $product->sku,
                'name_snapshot' => $product->name,
                'quantity' => $quantity,
                'unit_price' => $product->selling_price,
                'discount_amount' => 0,
                'line_total' => $product->selling_price * $quantity,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $subtotal = (float) $order->items()->sum('line_total');
        $order->update([
            'subtotal' => $subtotal,
            'discount' => 0,
            'tax' => 0,
            'total' => $subtotal,
            'updated_at' => now(),
        ]);
    }
}
