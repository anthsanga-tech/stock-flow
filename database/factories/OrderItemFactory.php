<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrderItem>
 */
class OrderItemFactory extends Factory
{
    protected $model = OrderItem::class;

    public function definition(): array
    {
        $quantity = fake()->numberBetween(1, 20);
        $unitPrice = fake()->randomFloat(2, 10, 250);

        return [
            'order_id' => Order::query()->inRandomOrder()->value('id')
                ?? Order::factory()->create()->id,
            'product_id' => Product::query()->inRandomOrder()->value('id')
                ?? Product::factory()->create()->id,
            'sku_snapshot' => fake()->bothify('SKU-####-???'),
            'name_snapshot' => fake()->words(2, true),
            'quantity' => $quantity,
            'unit_price' => $unitPrice,
            'line_total' => round($quantity * $unitPrice, 2),
        ];
    }
}
