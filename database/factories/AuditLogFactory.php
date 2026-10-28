<?php

namespace Database\Factories;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AuditLog>
 */
class AuditLogFactory extends Factory
{
    protected $model = AuditLog::class;

    public function definition(): array
    {
        return [
            'user_id' => User::query()->inRandomOrder()->value('id')
                ?? User::factory()->create()->id,
            'action' => fake()->randomElement(['created', 'updated', 'deleted', 'restored']),
            'entity_type' => fake()->randomElement(['order', 'product', 'supplier', 'customer']),
            'entity_id' => fake()->numberBetween(1, 100),
            'metadata' => [
                'source' => 'factory',
                'message' => fake()->sentence(),
            ],
            'created_at' => now(),
        ];
    }
}
