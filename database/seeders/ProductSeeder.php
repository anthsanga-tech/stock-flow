<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $electronics = Category::query()->where('slug', 'electronics')->value('id');
        $office = Category::query()->where('slug', 'office-supplies')->value('id');
        $hardware = Category::query()->where('slug', 'hardware')->value('id');
        $packaging = Category::query()->where('slug', 'packaging')->value('id');

        $products = [
            ['sku' => 'ELE-USB-C-01', 'name' => 'USB-C Cable', 'category_id' => $electronics, 'unit' => 'pcs', 'cost_price' => 9.50, 'selling_price' => 14.99, 'reorder_level' => 25, 'is_active' => true],
            ['sku' => 'OFF-PEN-01', 'name' => 'Ballpoint Pen', 'category_id' => $office, 'unit' => 'box', 'cost_price' => 5.25, 'selling_price' => 9.99, 'reorder_level' => 50, 'is_active' => true],
            ['sku' => 'HAR-SCREW-01', 'name' => 'Machine Screw', 'category_id' => $hardware, 'unit' => 'pack', 'cost_price' => 3.40, 'selling_price' => 6.25, 'reorder_level' => 100, 'is_active' => true],
            ['sku' => 'PKG-BAG-01', 'name' => 'Shipping Bag', 'category_id' => $packaging, 'unit' => 'box', 'cost_price' => 12.00, 'selling_price' => 20.50, 'reorder_level' => 40, 'is_active' => true],
        ];

        foreach ($products as $product) {
            Product::query()->updateOrCreate(['sku' => $product['sku']], $product);
        }
    }
}
