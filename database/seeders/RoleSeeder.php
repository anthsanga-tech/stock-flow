<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            ['name' => 'Admin', 'slug' => 'admin', 'is_active' => true],
            ['name' => 'Manager', 'slug' => 'manager', 'is_active' => true],
            ['name' => 'Staff', 'slug' => 'staff', 'is_active' => true],
        ];

        foreach ($roles as $role) {
            Role::query()->updateOrCreate(['slug' => $role['slug']], $role);
        }
    }
}
