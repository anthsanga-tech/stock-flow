<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrderStatusHistory>
 */
class OrderStatusHistoryFactory extends Factory
{
    protected $model = OrderStatusHistory::class;

    public function definition(): array
    {
        return [
            'order_id' => Order::query()->inRandomOrder()->value('id')
                ?? Order::factory()->create()->id,
            'from_status' => fake()->randomElement(['new', 'pending', 'processing']),
            'to_status' => fake()->randomElement(['pending', 'processing', 'completed', 'cancelled']),
            'changed_by' => User::query()->inRandomOrder()->value('id')
                ?? User::factory()->create()->id,
            'note' => fake()->sentence(),
            'created_at' => now(),
        ];
    }
}
