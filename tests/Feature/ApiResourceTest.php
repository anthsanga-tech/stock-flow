<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ApiResourceTest extends TestCase
{
    use RefreshDatabase;

    public function test_api_resources_require_authentication(): void
    {
        $this->getJson('/api/categories')->assertUnauthorized();
    }

    public function test_authenticated_user_can_manage_a_category(): void
    {
        $this->grantProductPermissions(User::factory()->create());

        $this->postJson('/api/categories', [
            'name' => 'Books',
            'slug' => 'books',
            'is_active' => true,
        ])->assertCreated()
            ->assertJsonPath('slug', 'books');

        $category = Category::query()->where('slug', 'books')->firstOrFail();

        $this->patchJson("/api/categories/{$category->id}", [
            'name' => 'Reference Books',
        ])->assertOk()
            ->assertJsonPath('name', 'Reference Books');

        $this->deleteJson("/api/categories/{$category->id}")->assertNoContent();
        $this->assertDatabaseMissing('categories', ['id' => $category->id]);
    }

    public function test_stock_balances_are_read_only_through_the_api(): void
    {
        $this->actingAs(User::factory()->create());

        $this->putJson('/api/stock-balances/1', [
            'quantity_on_hand' => 100,
        ])->assertMethodNotAllowed();
    }

    public function test_products_can_be_searched_filtered_sorted_and_paginated(): void
    {
        $this->grantProductPermissions(User::factory()->create(), canManage: false);
        $category = Category::factory()->create();

        Product::factory()->create([
            'name' => 'Widget Mini',
            'sku' => 'WIDGET-02',
            'category_id' => $category->id,
        ]);
        Product::factory()->create([
            'name' => 'Widget Pro',
            'sku' => 'WIDGET-01',
            'category_id' => $category->id,
        ]);
        Product::factory()->create([
            'name' => 'Cable',
            'sku' => 'CABLE-01',
            'category_id' => $category->id,
            'is_active' => false,
        ]);

        $this->getJson("/api/products?search=Widget&category_id={$category->id}&is_active=1&sort_by=name&sort_direction=desc&per_page=1")
            ->assertOk()
            ->assertJsonPath('total', 2)
            ->assertJsonPath('per_page', 1)
            ->assertJsonPath('data.0.name', 'Widget Pro');

        $this->getJson('/api/products?sort_by=unknown')->assertUnprocessable();
    }

    public function test_related_inventory_and_sales_resources_can_be_created(): void
    {
        $actor = User::factory()->create();
        $this->grantProductPermissions($actor);

        $role = $this->postJson('/api/roles', [
            'name' => 'Operator',
            'slug' => 'operator',
        ])->assertCreated()->json('id');
        $permission = $this->postJson('/api/permissions', [
            'name' => 'View Stock',
            'slug' => 'stock.view',
        ])->assertCreated()->json('id');
        $newUser = $this->postJson('/api/users', [
            'name' => 'Operator User',
            'email' => 'operator@example.test',
            'password' => 'test-password',
            'role_id' => $role,
            'is_active' => true,
        ])->assertCreated()->assertJsonMissingPath('password')->json('id');
        $this->assertTrue(Hash::check('test-password', User::query()->findOrFail($newUser)->password));

        $this->putJson("/api/roles/{$role}/permissions", [
            'permission_ids' => [$permission],
        ])->assertOk()->assertJsonPath('permissions.0.id', $permission);

        $category = $this->postJson('/api/categories', [
            'name' => 'Components',
            'slug' => 'components',
        ])->assertCreated()->json('id');
        $product = $this->postJson('/api/products', [
            'sku' => 'COMP-001',
            'name' => 'Component',
            'category_id' => $category,
            'unit' => 'pcs',
            'cost_price' => 2,
            'selling_price' => 4,
            'reorder_level' => 10,
        ])->assertCreated()->json('id');

        $supplier = $this->postJson('/api/suppliers', [
            'name' => 'Parts Supplier',
        ])->assertCreated()->json('id');
        $receipt = $this->postJson('/api/purchase-receipts', [
            'supplier_id' => $supplier,
            'receipt_number' => 'RCPT-001',
        ])->assertCreated()->json('id');
        $this->postJson('/api/purchase-receipt-items', [
            'receipt_id' => $receipt,
            'product_id' => $product,
            'quantity' => 5,
            'unit_cost' => 2,
        ])->assertCreated();

        $this->postJson('/api/inventory-movements', [
            'product_id' => $product,
            'movement_type' => 'inbound',
            'quantity_delta' => 5,
            'reference_type' => 'purchase_receipt',
            'reference_id' => $receipt,
            'reason' => 'Receipt test',
        ])->assertCreated()
            ->assertJsonPath('created_by', $actor->id)
            ->assertJsonPath('creator.id', $actor->id)
            ->assertJsonPath('reference.id', $receipt);

        $customer = $this->postJson('/api/customers', [
            'name' => 'Customer One',
        ])->assertCreated()->json('id');
        $order = $this->postJson('/api/orders', [
            'order_number' => 'ORD-001',
            'customer_id' => $customer,
            'status' => 'pending',
            'subtotal' => 8,
            'discount' => 0,
            'tax' => 0,
            'total' => 8,
        ])->assertCreated()->json('id');
        $this->postJson('/api/order-items', [
            'order_id' => $order,
            'product_id' => $product,
            'sku_snapshot' => 'COMP-001',
            'name_snapshot' => 'Component',
            'quantity' => 2,
            'unit_price' => 4,
            'line_total' => 8,
        ])->assertCreated();
        $this->postJson('/api/order-status-history', [
            'order_id' => $order,
            'from_status' => 'new',
            'to_status' => 'pending',
        ])->assertCreated()
            ->assertJsonPath('changed_by', $actor->id)
            ->assertJsonPath('changer.id', $actor->id);
        $this->postJson('/api/audit-logs', [
            'action' => 'created',
            'entity_type' => 'order',
            'entity_id' => $order,
            'metadata' => ['source' => 'test'],
        ])->assertCreated()->assertJsonPath('user_id', $actor->id);

        $this->assertTrue(Role::query()->findOrFail($role)->permissions()->exists());
        $this->assertTrue(Product::query()->findOrFail($product)->category()->exists());
    }

    private function grantProductPermissions(User $user, bool $canManage = true): void
    {
        $role = Role::factory()->create();
        $permissions = [
            Permission::factory()->create([
                'name' => 'View Products',
                'slug' => 'products.view',
            ]),
        ];

        if ($canManage) {
            $permissions[] = Permission::factory()->create([
                'name' => 'Manage Products',
                'slug' => 'products.manage',
            ]);
        }

        $role->permissions()->sync(collect($permissions)->pluck('id'));
        $user->update(['role_id' => $role->id]);

        $this->actingAs($user->refresh());
    }
}
