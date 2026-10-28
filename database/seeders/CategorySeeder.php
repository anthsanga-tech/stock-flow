<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['name' => 'Electronics', 'slug' => 'electronics', 'is_active' => true],
            ['name' => 'Office Supplies', 'slug' => 'office-supplies', 'is_active' => true],
            ['name' => 'Hardware', 'slug' => 'hardware', 'is_active' => true],
            ['name' => 'Packaging', 'slug' => 'packaging', 'is_active' => true],
        ];

        foreach ($categories as $category) {
            Category::query()->updateOrCreate(['slug' => $category['slug']], $category);
        }
    }
}
