<?php

namespace Database\Seeders;

use App\Models\Customer;
use Illuminate\Database\Seeder;

class CustomerSeeder extends Seeder
{
    public function run(): void
    {
        $customers = [
            ['name' => 'Alpha Retail', 'email' => 'orders@alpharetail.com', 'phone' => '+15550011', 'address' => '88 Main Avenue', 'is_active' => true],
            ['name' => 'Blue Market', 'email' => 'support@bluemarket.com', 'phone' => '+15550012', 'address' => '21 Harbor Lane', 'is_active' => true],
            ['name' => 'North Hill Shop', 'email' => 'hello@northhillshop.com', 'phone' => '+15550013', 'address' => '33 Garden Road', 'is_active' => true],
        ];

        foreach ($customers as $customer) {
            Customer::query()->updateOrCreate(['email' => $customer['email']], $customer);
        }
    }
}
