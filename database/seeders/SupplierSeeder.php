<?php

namespace Database\Seeders;

use App\Models\Supplier;
use Illuminate\Database\Seeder;

class SupplierSeeder extends Seeder
{
    public function run(): void
    {
        $suppliers = [
            ['supplier_code' => 'SUP-METRO', 'name' => 'Metro Wholesale', 'email' => 'sales@metro-wholesale.com', 'phone' => '+15550100', 'address' => '12 Industrial Rd', 'is_active' => true],
            ['supplier_code' => 'SUP-GLOBAL', 'name' => 'Global Tech Supply', 'email' => 'hello@globaltechsupply.com', 'phone' => '+15550101', 'address' => '45 Trade Avenue', 'is_active' => true],
            ['supplier_code' => 'SUP-PRIME', 'name' => 'Prime Goods Co.', 'email' => 'contact@primegoodsco.com', 'phone' => '+15550102', 'address' => '7 Market Street', 'is_active' => true],
        ];

        foreach ($suppliers as $supplier) {
            Supplier::query()->updateOrCreate(['email' => $supplier['email']], $supplier);
        }
    }
}
