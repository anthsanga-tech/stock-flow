<?php

namespace Database\Seeders;

use App\Models\PurchaseReceipt;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Database\Seeder;

class PurchaseReceiptSeeder extends Seeder
{
    public function run(): void
    {
        $supplier = Supplier::query()->first();
        $user = User::query()->first();

        if (! $supplier || ! $user) {
            return;
        }

        PurchaseReceipt::query()->updateOrCreate(
            ['receipt_number' => 'PR-1001'],
            [
                'supplier_id' => $supplier->id,
                'status' => 'received',
                'received_at' => now(),
                'created_by' => $user->id,
            ]
        );
    }
}
