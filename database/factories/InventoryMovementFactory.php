<?php

namespace Database\Factories;

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<InventoryMovement>
 */
class InventoryMovementFactory extends Factory
{
    protected $model = InventoryMovement::class;

    public function definition(): array
    {
        $movementType = fake()->randomElement(['inbound', 'outbound', 'adjustment']);

        return [
            'product_id' => Product::query()->inRandomOrder()->value('id')
                ?? Product::factory()->create()->id,
            'movement_type' => $movementType,
            'quantity_delta' => match ($movementType) {
                'inbound' => fake()->numberBetween(1, 50),
                'outbound' => fake()->numberBetween(-50, -1),
                default => fake()->numberBetween(-50, 50) ?: 1,
            },
            'reference_type' => null,
            'reference_id' => null,
            'reason' => fake()->sentence(4),
            'created_by' => User::query()->inRandomOrder()->value('id')
                ?? User::factory()->create()->id,
            'created_at' => now(),
        ];
    }
}
