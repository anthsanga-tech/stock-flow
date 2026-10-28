<?php

namespace Tests\Feature;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SpaAuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_sanctum_csrf_endpoint_sets_the_xsrf_cookie(): void
    {
        $this->withHeader('Origin', 'http://localhost:5173')
            ->get('/sanctum/csrf-cookie')
            ->assertNoContent()
            ->assertCookie('XSRF-TOKEN')
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
            ->assertHeader('Access-Control-Allow-Credentials', 'true');
    }

    public function test_login_authenticates_session_and_exposes_only_safe_user_data(): void
    {
        $user = User::factory()->create();
        $role = Role::factory()->create();
        $permission = Permission::factory()->create([
            'name' => 'View Products',
            'slug' => 'products.view',
        ]);
        $role->permissions()->attach($permission);
        $user->update(['role_id' => $role->id]);

        $this->withHeader('Origin', 'http://localhost:5173')
            ->get('/sanctum/csrf-cookie')
            ->assertNoContent();

        $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.permissions.0', 'products.view')
            ->assertJsonMissingPath('user.password');

        $this->getJson('/api/user')->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonMissingPath('user.password');

        $this->getJson('/api/products')->assertOk();
    }

    public function test_product_api_requires_a_role_permission(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->getJson('/api/products')->assertForbidden();

        $role = Role::factory()->create();
        $permission = Permission::factory()->create([
            'name' => 'View Products',
            'slug' => 'products.view',
        ]);
        $role->permissions()->attach($permission);
        $user->update(['role_id' => $role->id]);

        $this->actingAs($user->refresh())->getJson('/api/products')->assertOk();
    }

    public function test_logout_invalidates_session_and_protected_api_access(): void
    {
        $user = User::factory()->create();

        $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertOk();

        $this->postJson('/logout')->assertNoContent();
        $this->getJson('/api/user')->assertUnauthorized();
    }

    public function test_inactive_users_cannot_log_in_or_use_the_api(): void
    {
        $user = User::factory()->create(['is_active' => false]);

        $this->postJson('/login', [
            'email' => $user->email,
            'password' => 'password',
        ])->assertUnprocessable();

        $this->actingAs($user)->getJson('/api/user')->assertForbidden();
    }

    public function test_invalid_credentials_return_a_consistent_error(): void
    {
        $this->postJson('/login', [
            'email' => 'nobody@example.test',
            'password' => 'wrong-password',
        ])->assertUnprocessable()
            ->assertJsonPath('message', 'The provided credentials are incorrect.')
            ->assertJsonValidationErrors('email');
    }
}
