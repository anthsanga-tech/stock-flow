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
        $order = Order::query()->where('order_number', 'SO-1001')->first();
        $user = User::query()->first();

        if (! $order || ! $user) {
            return;
        }

        OrderStatusHistory::query()->updateOrCreate([
            'order_id' => $order->id,
            'to_status' => 'draft',
        ], [
            'from_status' => null,
            'changed_by' => $user->id,
            'note' => 'Draft sales order created.',
            'created_at' => now(),
        ]);
    }
}
