<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            PermissionSeeder::class,
            UserSeeder::class,
            RolePermissionSeeder::class,
            CategorySeeder::class,
            SupplierSeeder::class,
            CustomerSeeder::class,
            ProductSeeder::class,
            PurchaseReceiptSeeder::class,
            PurchaseReceiptItemSeeder::class,
            InventoryMovementSeeder::class,
            OrderSeeder::class,
            OrderItemSeeder::class,
            OrderStatusHistorySeeder::class,
            AuditLogSeeder::class,
        ]);
    }
}
