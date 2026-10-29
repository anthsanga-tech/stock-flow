<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\PermissionSeeder;
use Database\Seeders\RolePermissionSeeder;
use Database\Seeders\RoleSeeder;
use Database\Seeders\UserSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthorizationSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeders_assign_view_permission_to_demo_roles_and_users(): void
    {
        $this->seed(RoleSeeder::class);
        $this->seed(PermissionSeeder::class);
        $this->seed(UserSeeder::class);
        $this->seed(RolePermissionSeeder::class);

        $productView = Permission::query()->where('slug', 'products.view')->firstOrFail();
        $admin = Role::query()->where('slug', 'admin')->firstOrFail();
        $manager = Role::query()->where('slug', 'manager')->firstOrFail();
        $staff = Role::query()->where('slug', 'staff')->firstOrFail();

        $this->assertTrue($admin->permissions()->whereKey($productView->id)->exists());
        $this->assertTrue($manager->permissions()->whereKey($productView->id)->exists());
        $this->assertTrue($staff->permissions()->whereKey($productView->id)->exists());
        $this->assertSame(3, User::query()->where('role_id', $staff->id)->count());

        $this->seed(RolePermissionSeeder::class);
        $this->assertSame(
            1,
            $staff->permissions()->where('slug', 'products.view')->count(),
            'Re-running permission seeding should not duplicate role permissions.',
        );
    }
}
