<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $adminRole = Role::query()->firstOrCreate(
            ['slug' => 'admin'],
            ['name' => 'Admin', 'is_active' => true]
        );

        $managerRole = Role::query()->firstOrCreate(
            ['slug' => 'manager'],
            ['name' => 'Manager', 'is_active' => true]
        );

        User::query()->updateOrCreate(
            ['email' => 'admin@stockflow.test'],
            [
                'name' => 'System Admin',
                'password' => bcrypt('password'),
                'role_id' => $adminRole->id,
                'is_active' => true,
            ]
        );

        User::query()->updateOrCreate(
            ['email' => 'manager@stockflow.test'],
            [
                'name' => 'Store Manager',
                'password' => bcrypt('password'),
                'role_id' => $managerRole->id,
                'is_active' => true,
            ]
        );

        User::factory(3)->create();
    }
}
