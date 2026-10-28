<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Order;
use App\Models\User;
use Illuminate\Database\Seeder;

class OrderSeeder extends Seeder
{
    public function run(): void
    {
        $customer = Customer::query()->first();
        $user = User::query()->first();

        if (! $customer || ! $user) {
            return;
        }

        Order::query()->updateOrCreate(
            ['order_number' => 'SO-1001'],
            [
                'customer_id' => $customer->id,
                'status' => 'pending',
                'subtotal' => 120.00,
                'discount' => 10.00,
                'tax' => 8.40,
                'total' => 118.40,
                'created_by' => $user->id,
            ]
        );
    }
}
