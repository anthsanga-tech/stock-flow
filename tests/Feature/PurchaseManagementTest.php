<?php

namespace Tests\Feature;

use App\Models\InventoryMovement;
use App\Models\Permission;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\Role;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class PurchaseManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_suppliers_can_be_searched_updated_and_deactivated_without_deleting_history(): void
    {
        $this->userWithPurchasePermissions();
        $supplier = $this->postJson('/api/suppliers', [
            'supplier_code' => 'SUP-TEST-01',
            'name' => 'Test Supplier',
            'contact_person' => 'Jamie Lee',
        ])->assertCreated()
            ->assertJsonPath('supplier_code', 'SUP-TEST-01')
            ->assertJsonPath('contact_person', 'Jamie Lee')
            ->json('id');

        $this->postJson('/api/suppliers', [
            'supplier_code' => 'SUP-TEST-01',
            'name' => 'Duplicate Supplier',
        ])->assertUnprocessable()->assertJsonValidationErrors('supplier_code');

        $this->getJson('/api/suppliers?search=SUP-TEST&status=active')
            ->assertOk()->assertJsonPath('total', 1);
        $this->patchJson("/api/suppliers/{$supplier}", ['phone' => '555-0199'])
            ->assertOk()->assertJsonPath('phone', '555-0199');

        $this->deleteJson("/api/suppliers/{$supplier}")
            ->assertOk()->assertJsonPath('is_active', false);
        $this->assertDatabaseHas('suppliers', [
            'id' => $supplier,
            'supplier_code' => 'SUP-TEST-01',
            'is_active' => false,
        ]);
        $this->getJson('/api/suppliers?status=inactive')->assertOk()->assertJsonPath('total', 1);
    }

    public function test_supplier_and_purchase_order_routes_require_their_permissions(): void
    {
        $this->actingAs(User::factory()->create());

        $this->getJson('/api/suppliers')->assertForbidden();
        $this->postJson('/api/suppliers', [
            'supplier_code' => 'SUP-DENIED',
            'name' => 'Denied Supplier',
        ])->assertForbidden();
    }

    public function test_purchase_orders_calculate_totals_and_record_partial_and_complete_receipts(): void
    {
        $actor = $this->userWithPurchasePermissions();
        $supplier = Supplier::factory()->create();
        $product = Product::factory()->create();
        $order = $this->createPurchaseOrder($supplier, $product, 5, '2.50', [
            'subtotal' => 99999,
            'total' => 99999,
        ]);

        $this->assertSame('12.50', $order->total);
        $this->assertSame('12.50', $order->subtotal);
        $this->assertSame('5', (string) $order->items()->firstOrFail()->quantity);
        $this->assertSame($product->sku, $order->items()->firstOrFail()->sku_snapshot);
        $this->getJson('/api/purchase-orders?search='.$supplier->supplier_code
            .'&supplier_id='.$supplier->id
            .'&status=draft&order_from='.$order->order_date->toDateString()
            .'&expected_to='.$order->expected_delivery_date->toDateString()
            .'&per_page=1')
            ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.id', $order->id);
        $this->getJson("/api/suppliers/{$supplier->id}/purchase-orders")
            ->assertOk()->assertJsonPath('total', 1);

        $this->postJson("/api/purchase-orders/{$order->id}/submit")->assertOk()
            ->assertJsonPath('status', 'submitted');
        $this->postJson("/api/purchase-orders/{$order->id}/approve")->assertOk()
            ->assertJsonPath('status', 'approved');
        $this->getJson("/api/suppliers/{$supplier->id}")
            ->assertOk()->assertJsonPath('outstanding_purchase_orders_count', 1);

        $line = $order->items()->firstOrFail();
        $firstDelivery = [
            'idempotency_key' => (string) Str::uuid(),
            'received_at' => now()->toDateString(),
            'delivery_reference' => 'DN-001',
            'items' => [['purchase_order_item_id' => $line->id, 'quantity' => 2]],
        ];
        $this->postJson("/api/purchase-orders/{$order->id}/receipts", $firstDelivery)
            ->assertCreated()->assertJsonPath('delivery_reference', 'DN-001');
        $this->postJson("/api/purchase-orders/{$order->id}/receipts", $firstDelivery)
            ->assertOk();
        $this->postJson("/api/purchase-orders/{$order->id}/receipts", [
            ...$firstDelivery,
            'items' => [['purchase_order_item_id' => $line->id, 'quantity' => 1]],
        ])->assertStatus(409);

        $this->assertDatabaseHas('purchase_order_items', [
            'id' => $line->id,
            'received_quantity' => 2,
        ]);
        $this->assertDatabaseHas('purchase_orders', ['id' => $order->id, 'status' => 'partially_received']);
        $this->assertDatabaseHas('stock_balances', ['product_id' => $product->id, 'quantity_on_hand' => 2]);
        $this->assertDatabaseCount('inventory_movements', 1);

        $this->postJson("/api/purchase-orders/{$order->id}/receipts", [
            'idempotency_key' => (string) Str::uuid(),
            'received_at' => now()->toDateString(),
            'items' => [['purchase_order_item_id' => $line->id, 'quantity' => 3]],
        ])->assertCreated();

        $this->assertDatabaseHas('purchase_orders', ['id' => $order->id, 'status' => 'received']);
        $this->assertDatabaseHas('purchase_order_items', [
            'id' => $line->id,
            'received_quantity' => 5,
        ]);
        $this->assertDatabaseHas('stock_balances', ['product_id' => $product->id, 'quantity_on_hand' => 5]);
        $this->assertDatabaseCount('inventory_movements', 2);
        $this->assertSame(
            2,
            InventoryMovement::query()->where('created_by', $actor->id)->count()
        );
        $this->postJson("/api/purchase-orders/{$order->id}/cancel")
            ->assertUnprocessable()->assertJsonValidationErrors('status');
        $this->getJson('/api/goods-receipts?supplier_id='.$supplier->id.'&reference=DN-001')
            ->assertOk()->assertJsonPath('total', 1);
    }

    public function test_receipt_rejects_excess_quantity_and_rolls_back_everything_when_movement_fails(): void
    {
        $this->userWithPurchasePermissions();
        $supplier = Supplier::factory()->create();
        $product = Product::factory()->create();
        $order = $this->createPurchaseOrder($supplier, $product, 3, '4.00');
        $this->postJson("/api/purchase-orders/{$order->id}/submit")->assertOk();
        $this->postJson("/api/purchase-orders/{$order->id}/approve")->assertOk();
        $line = $order->items()->firstOrFail();

        $this->postJson("/api/purchase-orders/{$order->id}/receipts", [
            'idempotency_key' => (string) Str::uuid(),
            'received_at' => now()->toDateString(),
            'items' => [['purchase_order_item_id' => $line->id, 'quantity' => 4]],
        ])->assertUnprocessable()->assertJsonValidationErrors('items.0.quantity');
        $this->assertDatabaseCount('purchase_receipts', 0);

        DB::unprepared(<<<'SQL'
            CREATE TRIGGER reject_purchase_inventory_movement
            BEFORE INSERT ON inventory_movements
            BEGIN
                SELECT RAISE(ABORT, 'forced receipt movement failure');
            END
            SQL);
        $this->withoutExceptionHandling();

        try {
            $this->postJson("/api/purchase-orders/{$order->id}/receipts", [
                'idempotency_key' => (string) Str::uuid(),
                'received_at' => now()->toDateString(),
                'items' => [['purchase_order_item_id' => $line->id, 'quantity' => 2]],
            ]);
            $this->fail('The inventory movement insert should have failed.');
        } catch (QueryException) {
            $this->assertDatabaseCount('purchase_receipts', 0);
            $this->assertDatabaseCount('purchase_receipt_items', 0);
            $this->assertDatabaseCount('inventory_movements', 0);
            $this->assertDatabaseMissing('stock_balances', ['product_id' => $product->id]);
            $this->assertDatabaseHas('purchase_order_items', [
                'id' => $line->id,
                'received_quantity' => 0,
            ]);
            $this->assertDatabaseHas('purchase_orders', [
                'id' => $order->id,
                'status' => 'approved',
            ]);
        }
    }

    public function test_inactive_suppliers_cannot_be_used_to_create_purchase_orders(): void
    {
        $this->userWithPurchasePermissions();
        $supplier = Supplier::factory()->create(['is_active' => false]);
        $product = Product::factory()->create();

        $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'order_date' => now()->toDateString(),
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 1,
                'unit_cost' => 3.25,
            ]],
        ])->assertUnprocessable()->assertJsonValidationErrors('supplier_id');
    }

    public function test_draft_purchase_order_can_be_updated_with_recalculated_server_totals(): void
    {
        $this->userWithPurchasePermissions();
        $supplier = Supplier::factory()->create();
        $product = Product::factory()->create();
        $order = $this->createPurchaseOrder($supplier, $product, 2, '3.00');

        $this->putJson("/api/purchase-orders/{$order->id}", [
            'supplier_id' => $supplier->id,
            'order_date' => now()->toDateString(),
            'items' => [[
                'product_id' => $product->id,
                'quantity' => 4,
                'unit_cost' => '3.50',
            ]],
            'subtotal' => 1,
            'total' => 1,
        ])->assertOk()
            ->assertJsonPath('subtotal', '14.00')
            ->assertJsonPath('total', '14.00')
            ->assertJsonPath('items.0.quantity', 4)
            ->assertJsonPath('items.0.unit_cost', '3.50');
    }

    public function test_products_with_outstanding_purchase_orders_cannot_be_archived(): void
    {
        $this->userWithPurchasePermissions();
        $supplier = Supplier::factory()->create();
        $product = Product::factory()->create();
        $order = $this->createPurchaseOrder($supplier, $product, 3, '4.00');

        $this->patchJson("/api/products/{$product->id}", ['is_active' => 0])
            ->assertUnprocessable()->assertJsonValidationErrors('is_active');
        $this->assertDatabaseHas('products', ['id' => $product->id, 'is_active' => true]);

        $this->postJson("/api/purchase-orders/{$order->id}/cancel")->assertOk();
        $this->patchJson("/api/products/{$product->id}", ['is_active' => false])
            ->assertOk()->assertJsonPath('is_active', false);
    }

    public function test_purchase_order_lines_require_existing_active_products_positive_quantities_and_costs(): void
    {
        $this->userWithPurchasePermissions();
        $supplier = Supplier::factory()->create();
        $inactiveProduct = Product::factory()->create(['is_active' => false]);

        $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'order_date' => now()->toDateString(),
            'items' => [[
                'product_id' => $inactiveProduct->id,
                'quantity' => 0,
                'unit_cost' => 0,
            ]],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors([
                'items.0.quantity',
                'items.0.unit_cost',
            ]);

        $this->postJson('/api/purchase-orders', [
            'supplier_id' => $supplier->id,
            'order_date' => now()->toDateString(),
            'items' => [[
                'product_id' => $inactiveProduct->id,
                'quantity' => 1,
                'unit_cost' => 1,
            ]],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('items.0.product_id');
    }

    private function createPurchaseOrder(
        Supplier $supplier,
        Product $product,
        int $quantity,
        string $unitCost,
        array $extra = [],
    ): PurchaseOrder {
        $response = $this->postJson('/api/purchase-orders', array_merge([
            'supplier_id' => $supplier->id,
            'order_date' => now()->toDateString(),
            'expected_delivery_date' => now()->addDays(5)->toDateString(),
            'items' => [[
                'product_id' => $product->id,
                'quantity' => $quantity,
                'unit_cost' => $unitCost,
            ]],
        ], $extra))->assertCreated();

        return PurchaseOrder::query()->findOrFail($response->json('id'));
    }

    private function userWithPurchasePermissions(bool $canManage = true): User
    {
        $user = User::factory()->create();
        $role = Role::factory()->create();
        $permissions = [
            Permission::factory()->create(['name' => 'View Suppliers', 'slug' => 'suppliers.view']),
            Permission::factory()->create(['name' => 'Manage Products', 'slug' => 'products.manage']),
        ];
        if ($canManage) {
            $permissions[] = Permission::factory()->create(['name' => 'Manage Suppliers', 'slug' => 'suppliers.manage']);
        }

        $role->permissions()->sync(collect($permissions)->pluck('id'));
        $user->update(['role_id' => $role->id]);

        $this->actingAs($user->refresh());

        return $user->refresh();
    }
}
