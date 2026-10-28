<?php

namespace Database\Factories;

use App\Models\PurchaseReceipt;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PurchaseReceipt>
 */
class PurchaseReceiptFactory extends Factory
{
    protected $model = PurchaseReceipt::class;

    public function definition(): array
    {
        return [
            'supplier_id' => Supplier::query()->inRandomOrder()->value('id')
                ?? Supplier::factory()->create()->id,
            'receipt_number' => 'PR-' . fake()->unique()->numberBetween(1000, 9999),
            'status' => fake()->randomElement(['pending', 'received', 'cancelled']),
            'received_at' => now(),
            'created_by' => User::query()->inRandomOrder()->value('id')
                ?? User::factory()->create()->id,
        ];
    }
}
