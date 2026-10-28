<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\StockBalance;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InventoryManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_receiving_and_issuing_stock_updates_balance_and_audit_snapshots(): void
    {
        $actor = $this->userWithInventoryPermissions();
        $product = Product::factory()->create();

        $this->postJson('/api/inventory-movements', [
            'product_id' => $product->id,
            'movement_type' => 'inbound',
            'quantity_delta' => 12,
            'reason' => 'Initial delivery',
        ])->assertCreated()
            ->assertJsonPath('quantity_before', 0)
            ->assertJsonPath('quantity_after', 12)
            ->assertJsonPath('created_by', $actor->id);

        $this->postJson('/api/inventory-movements', [
            'product_id' => $product->id,
            'movement_type' => 'outbound',
            'quantity_delta' => -5,
            'reason' => 'Customer issue',
        ])->assertCreated()
            ->assertJsonPath('quantity_before', 12)
            ->assertJsonPath('quantity_after', 7);

        $this->assertDatabaseHas('stock_balances', [
            'product_id' => $product->id,
            'quantity_on_hand' => 7,
        ]);
        $this->assertDatabaseCount('inventory_movements', 2);
    }

    public function test_invalid_or_excessive_movements_do_not_change_balance_or_history(): void
    {
        $this->userWithInventoryPermissions();
        $product = Product::factory()->create();
        StockBalance::query()->create([
            'product_id' => $product->id,
            'quantity_on_hand' => 3,
            'updated_at' => now(),
        ]);

        $this->postJson('/api/inventory-movements', [
            'product_id' => $product->id,
            'movement_type' => 'outbound',
            'quantity_delta' => -4,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('quantity_delta');

        $this->postJson('/api/inventory-movements', [
            'product_id' => $product->id,
            'movement_type' => 'adjustment',
            'quantity_delta' => 0,
        ])->assertUnprocessable();

        $this->postJson('/api/inventory-movements', [
            'product_id' => $product->id,
            'movement_type' => 'adjustment',
            'quantity_delta' => -1,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('reason');

        $this->assertDatabaseHas('stock_balances', [
            'product_id' => $product->id,
            'quantity_on_hand' => 3,
        ]);
        $this->assertDatabaseCount('inventory_movements', 0);
    }

    public function test_stock_changes_require_manage_permission_and_active_users(): void
    {
        $product = Product::factory()->create();
        $payload = [
            'product_id' => $product->id,
            'movement_type' => 'inbound',
            'quantity_delta' => 4,
        ];
        $this->postJson('/api/inventory-movements', $payload)->assertUnauthorized();

        $this->actingAs($this->userWithInventoryPermissions(canManage: false));
        $this->postJson('/api/inventory-movements', $payload)->assertForbidden();

        $inactiveUser = $this->userWithInventoryPermissions();
        $inactiveUser->update(['is_active' => false]);
        $this->actingAs($inactiveUser->refresh());
        $this->postJson('/api/inventory-movements', $payload)->assertForbidden();
    }

    public function test_archived_products_cannot_receive_inventory_movements(): void
    {
        $this->userWithInventoryPermissions();
        $product = Product::factory()->create(['is_active' => false]);

        $this->postJson('/api/inventory-movements', [
            'product_id' => $product->id,
            'movement_type' => 'inbound',
            'quantity_delta' => 4,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('product_id');

        $this->assertDatabaseMissing('stock_balances', ['product_id' => $product->id]);
        $this->assertDatabaseCount('inventory_movements', 0);
    }

    public function test_inventory_history_filters_and_low_stock_use_product_reorder_levels(): void
    {
        $this->userWithInventoryPermissions();
        $lowStock = Product::factory()->create(['reorder_level' => 6]);
        $healthy = Product::factory()->create(['reorder_level' => 3]);
        $archived = Product::factory()->create(['reorder_level' => 100, 'is_active' => false]);

        foreach ([
            [$lowStock, 0],
            [$healthy, 10],
            [$archived, 0],
        ] as [$product, $quantity]) {
            if ($quantity > 0) {
                StockBalance::query()->create([
                    'product_id' => $product->id,
                    'quantity_on_hand' => $quantity,
                    'updated_at' => now(),
                ]);
            }
        }

        $this->postJson('/api/inventory-movements', [
            'product_id' => $lowStock->id,
            'movement_type' => 'inbound',
            'quantity_delta' => 5,
        ])->assertCreated();
        $this->postJson('/api/inventory-movements', [
            'product_id' => $healthy->id,
            'movement_type' => 'outbound',
            'quantity_delta' => -1,
        ])->assertCreated();
        $this->postJson('/api/inventory-movements', [
            'product_id' => $lowStock->id,
            'movement_type' => 'inbound',
            'quantity_delta' => 1,
        ])->assertCreated();

        $this->getJson('/api/inventory/low-stock?per_page=1')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $lowStock->id)
            ->assertJsonPath('active_products_count', 2)
            ->assertJsonPath('low_stock_count', 1);

        $today = now()->toDateString();
        $this->getJson("/api/inventory-movements?product_id={$lowStock->id}&movement_type=inbound&user_id=".auth()->id()."&from={$today}&to={$today}&per_page=1")
            ->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonPath('data.0.product_id', $lowStock->id)
            ->assertJsonPath('data.0.quantity_before', 5)
            ->assertJsonPath('per_page', 1)
            ->assertJsonPath('last_page', 2);

        $this->getJson("/api/inventory-movements?product_id={$lowStock->id}&movement_type=inbound&per_page=1&page=2")
            ->assertOk()
            ->assertJsonPath('current_page', 2)
            ->assertJsonPath('data.0.quantity_before', 0);

        $this->getJson("/api/stock-balances/{$healthy->id}")
            ->assertOk()
            ->assertJsonPath('quantity_on_hand', 9);
    }

    public function test_products_with_zero_reorder_level_are_low_stock_at_zero_quantity(): void
    {
        $this->userWithInventoryPermissions(canManage: false);
        $product = Product::factory()->create(['reorder_level' => 0]);

        $this->getJson('/api/inventory/low-stock')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $product->id)
            ->assertJsonPath('data.0.quantity_on_hand', 0);
    }

    private function userWithInventoryPermissions(bool $canManage = true): User
    {
        $user = User::factory()->create();
        $role = Role::factory()->create();
        $permissions = [
            Permission::query()->firstOrCreate(
                ['slug' => 'products.view'],
                ['name' => 'View Products', 'is_active' => true],
            ),
        ];

        if ($canManage) {
            $permissions[] = Permission::query()->firstOrCreate(
                ['slug' => 'products.manage'],
                ['name' => 'Manage Products', 'is_active' => true],
            );
        }

        $role->permissions()->sync(collect($permissions)->pluck('id'));
        $user->update(['role_id' => $role->id]);

        $user = $user->refresh();
        $this->actingAs($user);

        return $user;
    }
}
