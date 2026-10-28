<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\PurchaseReceipt;
use App\Models\PurchaseReceiptItem;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PurchaseReceiptItem>
 */
class PurchaseReceiptItemFactory extends Factory
{
    protected $model = PurchaseReceiptItem::class;

    public function definition(): array
    {
        $quantity = fake()->numberBetween(1, 100);
        $unitCost = fake()->randomFloat(2, 5, 300);

        return [
            'receipt_id' => PurchaseReceipt::query()->inRandomOrder()->value('id')
                ?? PurchaseReceipt::factory()->create()->id,
            'product_id' => Product::query()->inRandomOrder()->value('id')
                ?? Product::factory()->create()->id,
            'quantity' => $quantity,
            'unit_cost' => $unitCost,
        ];
    }
}
