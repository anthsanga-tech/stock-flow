<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\InventoryMovement;
use App\Models\Permission;
use App\Models\Product;
use App\Models\PurchaseReceipt;
use App\Models\PurchaseReceiptItem;
use App\Models\Role;
use App\Models\StockBalance;
use App\Models\Supplier;
use App\Models\User;
use App\Services\InventoryService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class InventoryManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_creation_initializes_zero_balance_without_movement(): void
    {
        $this->userWithInventoryPermissions();
        $category = Category::factory()->create();

        $this->postJson('/api/products', [
            'sku' => 'ZERO-001',
            'name' => 'Zero stock product',
            'category_id' => $category->id,
            'unit' => 'pcs',
            'cost_price' => 1,
            'selling_price' => 2,
            'reorder_level' => 0,
        ])->assertCreated()
            ->assertJsonPath('stock_balance.quantity_on_hand', 0);

        $product = Product::query()->where('sku', 'ZERO-001')->firstOrFail();
        $this->assertDatabaseHas('stock_balances', [
            'product_id' => $product->id,
            'quantity_on_hand' => 0,
        ]);
        $this->assertDatabaseCount('inventory_movements', 0);
    }

    public function test_product_creation_records_provided_initial_stock_as_inbound_movement(): void
    {
        $this->userWithInventoryPermissions();
        $category = Category::factory()->create();

        $this->postJson('/api/products', [
            'sku' => 'OPEN-001',
            'name' => 'Opening stock product',
            'category_id' => $category->id,
            'unit' => 'pcs',
            'cost_price' => 1,
            'selling_price' => 2,
            'reorder_level' => 0,
            'initial_stock' => 8,
        ])->assertCreated()
            ->assertJsonPath('stock_balance.quantity_on_hand', 8);

        $product = Product::query()->where('sku', 'OPEN-001')->firstOrFail();
        $this->assertDatabaseHas('stock_balances', [
            'product_id' => $product->id,
            'quantity_on_hand' => 8,
        ]);
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $product->id,
            'movement_type' => 'inbound',
            'quantity_delta' => 8,
            'quantity_before' => 0,
            'quantity_after' => 8,
            'reason' => 'Initial stock',
        ]);
    }

    public function test_failed_opening_movement_rolls_back_product_and_balance_creation(): void
    {
        $this->userWithInventoryPermissions();
        $category = Category::factory()->create();

        DB::unprepared(<<<'SQL'
            CREATE TRIGGER reject_opening_inventory_movement
            BEFORE INSERT ON inventory_movements
            BEGIN
                SELECT RAISE(ABORT, 'forced opening movement failure');
            END
            SQL);
        $this->withoutExceptionHandling();

        try {
            $this->postJson('/api/products', [
                'sku' => 'ROLLBACK-001',
                'name' => 'Rollback product',
                'category_id' => $category->id,
                'unit' => 'pcs',
                'cost_price' => 1,
                'selling_price' => 2,
                'reorder_level' => 0,
                'initial_stock' => 8,
            ]);
            $this->fail('The opening movement insert should have failed.');
        } catch (QueryException) {
            $this->assertDatabaseMissing('products', ['sku' => 'ROLLBACK-001']);
            $this->assertDatabaseCount('stock_balances', 0);
            $this->assertDatabaseCount('inventory_movements', 0);
        }
    }

    public function test_invalid_initial_stock_is_rejected_without_creating_product_or_inventory_rows(): void
    {
        $this->userWithInventoryPermissions();
        $category = Category::factory()->create();

        $this->postJson('/api/products', [
            'sku' => 'INVALID-001',
            'name' => 'Invalid initial stock',
            'category_id' => $category->id,
            'unit' => 'pcs',
            'cost_price' => 1,
            'selling_price' => 2,
            'reorder_level' => 0,
            'initial_stock' => 'Error',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('initial_stock');

        $this->assertDatabaseMissing('products', ['sku' => 'INVALID-001']);
        $this->assertDatabaseCount('stock_balances', 0);
        $this->assertDatabaseCount('inventory_movements', 0);
    }

    public function test_database_rejects_non_numeric_movement_snapshots(): void
    {
        $product = Product::factory()->create();

        try {
            InventoryMovement::query()->create([
                'product_id' => $product->id,
                'movement_type' => 'inbound',
                'quantity_delta' => 1,
                'quantity_before' => 'Error',
                'quantity_after' => 1,
                'created_at' => now(),
            ]);
            $this->fail('The database should reject a non-numeric quantity snapshot.');
        } catch (QueryException) {
            $this->assertDatabaseCount('inventory_movements', 0);
        }
    }

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
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $product->id,
            'movement_type' => 'inbound',
            'quantity_delta' => 12,
            'quantity_before' => 0,
            'quantity_after' => 12,
        ]);
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $product->id,
            'movement_type' => 'outbound',
            'quantity_delta' => -5,
            'quantity_before' => 12,
            'quantity_after' => 7,
        ]);
        $this->assertDatabaseCount('inventory_movements', 2);
    }

    public function test_two_receipts_then_a_five_unit_issue_keep_balance_and_movement_history_in_sync(): void
    {
        $this->userWithInventoryPermissions();
        $product = Product::factory()->create();

        foreach ([0, 25] as $quantityBefore) {
            $this->postJson('/api/inventory-movements', [
                'product_id' => $product->id,
                'movement_type' => 'inbound',
                'quantity_delta' => 25,
                'reason' => 'Supplier receipt',
            ])->assertCreated()
                ->assertJsonPath('quantity_before', $quantityBefore)
                ->assertJsonPath('quantity_after', $quantityBefore + 25);
        }

        $this->postJson('/api/inventory-movements', [
            'product_id' => $product->id,
            'movement_type' => 'outbound',
            'quantity_delta' => -5,
            'reason' => 'Customer issue',
        ])->assertCreated()
            ->assertJsonPath('quantity_before', 50)
            ->assertJsonPath('quantity_after', 45);

        $this->assertDatabaseHas('stock_balances', [
            'product_id' => $product->id,
            'quantity_on_hand' => 45,
        ]);
        $this->assertDatabaseCount('inventory_movements', 3);
        $this->assertSame(
            [25, 25, -5],
            InventoryMovement::query()
                ->where('product_id', $product->id)
                ->orderBy('id')
                ->pluck('quantity_delta')
                ->all(),
        );
    }

    public function test_failed_movement_insert_rolls_back_the_balance_update(): void
    {
        $actor = $this->userWithInventoryPermissions();
        $product = Product::factory()->create();

        DB::unprepared(<<<'SQL'
            CREATE TRIGGER reject_inventory_movement_insert
            BEFORE INSERT ON inventory_movements
            BEGIN
                SELECT RAISE(ABORT, 'forced inventory movement failure');
            END
            SQL);

        try {
            app(InventoryService::class)->recordMovement([
                'product_id' => $product->id,
                'movement_type' => 'inbound',
                'quantity_delta' => 25,
            ], $actor->id);
            $this->fail('The movement insert should have failed.');
        } catch (QueryException) {
            $this->assertDatabaseMissing('stock_balances', ['product_id' => $product->id]);
            $this->assertDatabaseCount('inventory_movements', 0);
        }
    }

    public function test_adjustments_update_the_balance_and_append_a_movement(): void
    {
        $this->userWithInventoryPermissions();
        $product = Product::factory()->create();

        $this->postJson('/api/inventory-movements', [
            'product_id' => $product->id,
            'movement_type' => 'inbound',
            'quantity_delta' => 10,
        ])->assertCreated();

        $this->postJson('/api/inventory-movements', [
            'product_id' => $product->id,
            'movement_type' => 'adjustment',
            'quantity_delta' => -3,
            'reason' => 'Count correction',
        ])->assertCreated()
            ->assertJsonPath('quantity_before', 10)
            ->assertJsonPath('quantity_after', 7);

        $this->assertDatabaseHas('stock_balances', [
            'product_id' => $product->id,
            'quantity_on_hand' => 7,
        ]);
        $this->assertDatabaseCount('inventory_movements', 2);
    }

    public function test_seeded_receipt_lines_generate_matching_movements_and_balances_on_repeated_runs(): void
    {
        User::factory()->create();
        $supplier = Supplier::factory()->create();
        $receipt = PurchaseReceipt::factory()->create([
            'supplier_id' => $supplier->id,
            'receipt_number' => 'PR-1001',
            'status' => 'received',
        ]);
        $products = Product::factory()->count(2)->create();
        $receiptItemSeeder = app(\Database\Seeders\PurchaseReceiptItemSeeder::class);
        $movementSeeder = app(\Database\Seeders\InventoryMovementSeeder::class);
        $inventory = app(InventoryService::class);

        $receiptItemSeeder->run();
        $movementSeeder->run($inventory);
        $receiptItemSeeder->run();
        $movementSeeder->run($inventory);

        $this->assertDatabaseCount('inventory_movements', 2);
        $this->assertDatabaseCount('purchase_receipt_items', 2);
        $this->assertDatabaseCount('stock_balances', 2);

        foreach ($products as $index => $product) {
            $expectedQuantity = 50 + $index * 10;

            $this->assertSame(
                $expectedQuantity,
                (int) PurchaseReceiptItem::query()
                    ->where('receipt_id', $receipt->id)
                    ->where('product_id', $product->id)
                    ->value('quantity'),
            );
            $this->assertDatabaseHas('inventory_movements', [
                'product_id' => $product->id,
                'movement_type' => 'inbound',
                'quantity_delta' => $expectedQuantity,
                'reference_type' => 'purchase_receipt',
                'reference_id' => $receipt->id,
            ]);
            $this->assertDatabaseHas('stock_balances', [
                'product_id' => $product->id,
                'quantity_on_hand' => $expectedQuantity,
            ]);
        }

        $this->assertSame(0, Product::query()
            ->whereNotIn('id', $products->modelKeys())
            ->has('inventoryMovements')
            ->count());
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
