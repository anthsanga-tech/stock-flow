<?php

namespace Database\Factories;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        $categoryId = Category::query()->inRandomOrder()->value('id')
            ?? Category::factory()->create()->id;

        $costPrice = fake()->randomFloat(2, 10, 500);

        return [
            'sku' => fake()->unique()->bothify('SKU-####-???'),
            'name' => fake()->words(2, true),
            'category_id' => $categoryId,
            'unit' => fake()->randomElement(['pcs', 'box', 'pack', 'kg']),
            'cost_price' => $costPrice,
            'selling_price' => round($costPrice * fake()->randomFloat(1, 1.3, 2.5), 2),
            'reorder_level' => fake()->numberBetween(10, 100),
            'is_active' => true,
        ];
    }
}
