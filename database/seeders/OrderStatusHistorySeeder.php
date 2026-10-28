<?php

namespace Database\Seeders;

use App\Models\Order;
use App\Models\OrderStatusHistory;
use App\Models\User;
use Illuminate\Database\Seeder;

class OrderStatusHistorySeeder extends Seeder
{
    public function run(): void
    {
        $order = Order::query()->first();
        $user = User::query()->first();

        if (! $order || ! $user) {
            return;
        }

        OrderStatusHistory::query()->create([
            'order_id' => $order->id,
            'from_status' => 'new',
            'to_status' => 'pending',
            'changed_by' => $user->id,
            'note' => 'Order created and queued for processing.',
            'created_at' => now(),
        ]);
    }
}
