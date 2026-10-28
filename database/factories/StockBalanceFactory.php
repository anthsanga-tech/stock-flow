<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\StockBalance;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StockBalance>
 */
class StockBalanceFactory extends Factory
{
    protected $model = StockBalance::class;

    public function definition(): array
    {
        return [
            'product_id' => Product::query()->inRandomOrder()->value('id')
                ?? Product::factory()->create()->id,
            'quantity_on_hand' => fake()->numberBetween(0, 500),
            'updated_at' => now(),
        ];
    }
}
