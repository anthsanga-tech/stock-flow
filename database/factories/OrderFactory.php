<?php

namespace Database\Factories;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
{
    protected $model = Order::class;

    public function definition(): array
    {
        $subtotal = fake()->randomFloat(2, 50, 1000);
        $discount = fake()->randomFloat(2, 0, min(100, $subtotal));
        $tax = fake()->randomFloat(2, 0, 120);

        return [
            'order_number' => 'SO-'.fake()->unique()->numberBetween(1000, 9999),
            'customer_id' => Customer::query()->inRandomOrder()->value('id')
                ?? Customer::factory()->create()->id,
            'order_date' => now()->toDateString(),
            'status' => fake()->randomElement(['draft', 'confirmed', 'processing', 'completed', 'cancelled']),
            'subtotal' => $subtotal,
            'discount' => $discount,
            'tax' => $tax,
            'total' => round($subtotal - $discount + $tax, 2),
            'created_by' => User::query()->inRandomOrder()->value('id')
                ?? User::factory()->create()->id,
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }
}
