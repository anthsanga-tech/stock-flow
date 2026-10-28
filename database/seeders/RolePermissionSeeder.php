<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $adminRole = Role::query()->where('slug', 'admin')->first();
        $managerRole = Role::query()->where('slug', 'manager')->first();
        $staffRole = Role::query()->where('slug', 'staff')->first();

        $adminPermissions = Permission::query()->pluck('id')->all();
        $managerPermissions = Permission::query()->whereIn('slug', [
            'products.view',
            'products.manage',
            'inventory.view',
            'inventory.manage',
            'orders.view',
            'orders.manage',
            'suppliers.view',
            'customers.view',
        ])->pluck('id')->all();
        $staffPermissions = Permission::query()->whereIn('slug', [
            'products.view',
            'inventory.view',
            'orders.view',
        ])->pluck('id')->all();

        foreach ([
            [$adminRole, $adminPermissions],
            [$managerRole, $managerPermissions],
            [$staffRole, $staffPermissions],
        ] as [$role, $permissionIds]) {
            if (! $role) {
                continue;
            }

            foreach ($permissionIds as $permissionId) {
                DB::table('permission_role')->upsert([
                    'role_id' => $role->id,
                    'permission_id' => $permissionId,
                ], ['role_id', 'permission_id']);
            }
        }
    }
}
