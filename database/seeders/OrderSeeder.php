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
                'status' => 'draft',
                'order_date' => now()->toDateString(),
                'subtotal' => 0,
                'discount' => 0,
                'tax' => 0,
                'total' => 0,
                'created_by' => $user->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );
    }
}
