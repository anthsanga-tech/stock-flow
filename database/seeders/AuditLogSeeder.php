<?php

namespace Database\Seeders;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Seeder;

class AuditLogSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::query()->first();

        if (! $user) {
            return;
        }

        AuditLog::query()->create([
            'user_id' => $user->id,
            'action' => 'created',
            'entity_type' => 'order',
            'entity_id' => 1,
            'metadata' => ['source' => 'seed'],
            'created_at' => now(),
        ]);
    }
}
