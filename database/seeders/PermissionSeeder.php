<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            ['name' => 'View Products', 'slug' => 'products.view', 'is_active' => true],
            ['name' => 'Manage Products', 'slug' => 'products.manage', 'is_active' => true],
            ['name' => 'View Inventory', 'slug' => 'inventory.view', 'is_active' => true],
            ['name' => 'Manage Inventory', 'slug' => 'inventory.manage', 'is_active' => true],
            ['name' => 'View Orders', 'slug' => 'orders.view', 'is_active' => true],
            ['name' => 'Manage Orders', 'slug' => 'orders.manage', 'is_active' => true],
            ['name' => 'View Suppliers', 'slug' => 'suppliers.view', 'is_active' => true],
            ['name' => 'Manage Suppliers', 'slug' => 'suppliers.manage', 'is_active' => true],
            ['name' => 'View Customers', 'slug' => 'customers.view', 'is_active' => true],
            ['name' => 'Manage Customers', 'slug' => 'customers.manage', 'is_active' => true],
        ];

        foreach ($permissions as $permission) {
            Permission::query()->updateOrCreate(['slug' => $permission['slug']], $permission);
        }
    }
}
