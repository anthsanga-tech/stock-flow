<?php

namespace Database\Seeders;

use App\Models\Customer;
use Illuminate\Database\Seeder;

class CustomerSeeder extends Seeder
{
    public function run(): void
    {
        $customers = [
            ['customer_code' => 'CUS-DEMO-001', 'name' => 'Alpha Retail', 'email' => 'orders@alpharetail.com', 'phone' => '+15550011', 'company_name' => 'Alpha Retail', 'address' => '88 Main Avenue', 'billing_address' => '88 Main Avenue', 'shipping_address' => '88 Main Avenue', 'status' => 'active', 'is_active' => true],
            ['customer_code' => 'CUS-DEMO-002', 'name' => 'Blue Market', 'email' => 'support@bluemarket.com', 'phone' => '+15550012', 'company_name' => 'Blue Market', 'address' => '21 Harbor Lane', 'billing_address' => '21 Harbor Lane', 'shipping_address' => '21 Harbor Lane', 'status' => 'active', 'is_active' => true],
            ['customer_code' => 'CUS-DEMO-003', 'name' => 'North Hill Shop', 'email' => 'hello@northhillshop.com', 'phone' => '+15550013', 'company_name' => 'North Hill Shop', 'address' => '33 Garden Road', 'billing_address' => '33 Garden Road', 'shipping_address' => '33 Garden Road', 'status' => 'active', 'is_active' => true],
        ];

        foreach ($customers as $customer) {
            Customer::query()->updateOrCreate(['email' => $customer['email']], [
                ...$customer,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}
