<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Permission;
use App\Models\Product;
use App\Models\Role;
use App\Models\StockBalance;
use App\Models\StockReservation;
use App\Models\User;
use App\Services\InventoryService;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class CustomerSalesOrderTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_crud_search_status_and_unique_codes(): void
    {
        $this->userWithSalesPermissions();
        $customerId = $this->postJson('/api/customers', [
            'name' => 'Acme Retail',
            'company_name' => 'Acme Ltd',
            'email' => 'sales@acme.test',
            'phone' => '555-0101',
            'billing_address' => '1 Main Street',
            'shipping_address' => '2 Main Street',
            'status' => 'active',
        ])->assertCreated()
            ->assertJsonPath('status', 'active')
            ->json('id');

        $customer = Customer::query()->findOrFail($customerId);
        $this->assertStringStartsWith('CUS-', $customer->customer_code);
        $this->patchJson("/api/customers/{$customerId}", [
            'name' => 'Acme Stores',
            'status' => 'inactive',
        ])->assertOk()->assertJsonPath('status', 'inactive');

        $this->getJson('/api/customers?search=Acme&status=inactive&sort_by=name&sort_direction=asc')
            ->assertOk()->assertJsonPath('total', 1)->assertJsonPath('data.0.name', 'Acme Stores');
        $this->getJson('/api/customers?search=sales@acme.test')
            ->assertOk()->assertJsonPath('total', 1);
        $this->assertDatabaseHas('customers', ['id' => $customerId, 'is_active' => false]);

        try {
            DB::table('customers')->insert([
                'customer_code' => $customer->customer_code,
                'name' => 'Duplicate Code',
                'is_active' => true,
                'status' => 'active',
            ]);
            $this->fail('A duplicate customer code should violate the unique constraint.');
        } catch (QueryException) {
            $this->assertDatabaseCount('customers', 1);
        }
    }

    public function test_customer_deletion_is_rejected_when_orders_exist(): void
    {
        $this->userWithSalesPermissions();
        $customer = Customer::factory()->create();
        $product = Product::factory()->create();
        $this->makeOrder($customer, [['product_id' => $product->id, 'quantity' => 1, 'unit_price' => 4]]);

        $this->deleteJson("/api/customers/{$customer->id}")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('customer');
        $this->assertDatabaseHas('customers', ['id' => $customer->id]);
    }

    public function test_draft_orders_calculate_discounts_and_preserve_historical_prices(): void
    {
        $this->userWithSalesPermissions();
        $customer = Customer::factory()->create();
        $productA = Product::factory()->create(['selling_price' => 12.50]);
        $productB = Product::factory()->create(['selling_price' => 5]);
        $order = $this->makeOrder($customer, [
            ['product_id' => $productA->id, 'quantity' => 2, 'unit_price' => 10, 'discount_amount' => 2],
            ['product_id' => $productB->id, 'quantity' => 3, 'unit_price' => 5, 'discount_amount' => 1],
        ], ['discount_amount' => 3, 'tax' => 2.50]);

        $this->assertSame('32.00', $order->subtotal);
        $this->assertSame('3.00', $order->discount);
        $this->assertSame('2.50', $order->tax);
        $this->assertSame('31.50', $order->total);
        $this->assertNotNull($order->created_at);
        $this->assertNotNull($order->updated_at);
        $this->assertSame('10.00', $order->items[0]->unit_price);
        $productA->update(['selling_price' => 99]);
        $this->assertSame('10.00', $order->refresh()->items()->where('product_id', $productA->id)->value('unit_price'));

        $this->patchJson("/api/orders/{$order->id}", ['discount_amount' => 4, 'tax' => 1])
            ->assertOk()->assertJsonPath('subtotal', '32.00')->assertJsonPath('total', '29.00');
    }

    public function test_invalid_prices_quantities_and_inactive_customers_or_products_are_rejected(): void
    {
        $this->userWithSalesPermissions();
        $customer = Customer::factory()->create();
        $product = Product::factory()->create();

        $this->postJson('/api/orders', [
            'customer_id' => $customer->id,
            'order_date' => now()->toDateString(),
            'items' => [['product_id' => $product->id, 'quantity' => 0, 'unit_price' => 4]],
        ])->assertUnprocessable()->assertJsonValidationErrors('items.0.quantity');
        $this->postJson('/api/orders', [
            'customer_id' => $customer->id,
            'order_date' => now()->toDateString(),
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'unit_price' => -1]],
        ])->assertUnprocessable()->assertJsonValidationErrors('items.0.unit_price');

        $product->update(['is_active' => false]);
        $this->postJson('/api/orders', [
            'customer_id' => $customer->id,
            'order_date' => now()->toDateString(),
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'unit_price' => 4]],
        ])->assertUnprocessable()->assertJsonValidationErrors('items.0.product_id');

        $product->update(['is_active' => true]);
        $customer->update(['status' => 'inactive']);
        $customer->update(['status' => 'active']);
        $order = $this->makeOrder($customer, [['product_id' => $product->id, 'quantity' => 1, 'unit_price' => 4]]);
        $customer->update(['status' => 'inactive']);
        $this->postJson("/api/orders/{$order->id}/confirm")
            ->assertUnprocessable()->assertJsonValidationErrors('customer_id');

        $this->postJson('/api/orders', [
            'customer_id' => $customer->id,
            'order_date' => now()->toDateString(),
            'items' => [['product_id' => $product->id, 'quantity' => 1, 'unit_price' => 4]],
        ])->assertUnprocessable()->assertJsonValidationErrors('customer_id');
    }

    public function test_confirmation_reserves_stock_and_prevents_overselling(): void
    {
        $this->userWithSalesPermissions();
        $customer = Customer::factory()->create();
        $product = Product::factory()->create();
        $this->setStock($product, 10);
        $firstOrder = $this->makeOrder($customer, [['product_id' => $product->id, 'quantity' => 6, 'unit_price' => 4]]);
        $secondOrder = $this->makeOrder($customer, [['product_id' => $product->id, 'quantity' => 5, 'unit_price' => 4]]);

        $this->postJson("/api/orders/{$firstOrder->id}/confirm")->assertOk()->assertJsonPath('status', 'confirmed');
        $this->postJson("/api/orders/{$firstOrder->id}/confirm")->assertOk()->assertJsonPath('status', 'confirmed');
        $this->assertSame(1, StockReservation::query()->where('sales_order_id', $firstOrder->id)->count());
        $this->getJson('/api/orders/products')->assertOk()->assertJsonPath('data.0.available_quantity', 4);

        $this->postJson("/api/orders/{$secondOrder->id}/confirm")
            ->assertUnprocessable()->assertJsonValidationErrors('items');
        $this->assertDatabaseMissing('stock_reservations', ['sales_order_id' => $secondOrder->id]);
        $this->assertDatabaseHas('stock_balances', ['product_id' => $product->id, 'quantity_on_hand' => 10]);
    }

    public function test_processing_does_not_deduct_stock_and_completion_deducts_once(): void
    {
        $actor = $this->userWithSalesPermissions();
        $customer = Customer::factory()->create();
        $product = Product::factory()->create();
        $this->setStock($product, 10);
        $order = $this->makeOrder($customer, [['product_id' => $product->id, 'quantity' => 4, 'unit_price' => 4]]);

        $this->postJson("/api/orders/{$order->id}/process")->assertUnprocessable();
        $this->postJson("/api/orders/{$order->id}/confirm")->assertOk();
        $this->postJson("/api/orders/{$order->id}/process")->assertOk()->assertJsonPath('status', 'processing');
        $this->assertDatabaseHas('stock_balances', ['product_id' => $product->id, 'quantity_on_hand' => 10]);
        $this->postJson("/api/orders/{$order->id}/complete")->assertOk()->assertJsonPath('status', 'completed');
        $this->postJson("/api/orders/{$order->id}/complete")->assertOk()->assertJsonPath('status', 'completed');

        $this->assertDatabaseHas('stock_balances', ['product_id' => $product->id, 'quantity_on_hand' => 6]);
        $this->assertDatabaseCount('inventory_movements', 1);
        $this->assertDatabaseHas('inventory_movements', [
            'product_id' => $product->id,
            'movement_type' => 'outbound',
            'quantity_delta' => -4,
            'reference_type' => 'order',
            'reference_id' => $order->id,
            'created_by' => $actor->id,
        ]);
        $this->assertDatabaseHas('stock_reservations', ['sales_order_id' => $order->id, 'status' => 'consumed']);
        $this->postJson("/api/orders/{$order->id}/cancel")->assertUnprocessable();
    }

    public function test_cancellation_releases_reservations_without_deducting_physical_stock(): void
    {
        $this->userWithSalesPermissions();
        $customer = Customer::factory()->create();
        $product = Product::factory()->create();
        $this->setStock($product, 8);
        $order = $this->makeOrder($customer, [['product_id' => $product->id, 'quantity' => 5, 'unit_price' => 2]]);

        $this->postJson("/api/orders/{$order->id}/confirm")->assertOk();
        $this->postJson("/api/orders/{$order->id}/cancel")->assertOk()->assertJsonPath('status', 'cancelled');
        $this->assertDatabaseHas('stock_balances', ['product_id' => $product->id, 'quantity_on_hand' => 8]);
        $this->assertDatabaseHas('stock_reservations', ['sales_order_id' => $order->id, 'status' => 'released']);
        $this->assertDatabaseCount('inventory_movements', 0);
        $this->getJson('/api/orders/products')->assertOk()->assertJsonPath('data.0.available_quantity', 8);
    }

    public function test_other_outbound_movements_cannot_consume_reserved_stock(): void
    {
        $actor = $this->userWithSalesPermissions();
        $customer = Customer::factory()->create();
        $product = Product::factory()->create();
        $this->setStock($product, 5);
        $order = $this->makeOrder($customer, [['product_id' => $product->id, 'quantity' => 4, 'unit_price' => 2]]);
        $this->postJson("/api/orders/{$order->id}/confirm")->assertOk();

        try {
            app(InventoryService::class)->recordMovement([
                'product_id' => $product->id,
                'movement_type' => 'outbound',
                'quantity_delta' => -2,
            ], $actor->id);
            $this->fail('A manual stock issue must not consume reserved inventory.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('quantity_delta', $exception->errors());
        }

        $this->assertDatabaseHas('stock_balances', ['product_id' => $product->id, 'quantity_on_hand' => 5]);
        $this->assertDatabaseCount('inventory_movements', 0);
    }

    public function test_products_with_active_reservations_cannot_be_archived_or_deleted_from_order_history(): void
    {
        $this->userWithSalesPermissions();
        $customer = Customer::factory()->create();
        $product = Product::factory()->create();
        $this->setStock($product, 5);
        $order = $this->makeOrder($customer, [['product_id' => $product->id, 'quantity' => 3, 'unit_price' => 2]]);
        $this->postJson("/api/orders/{$order->id}/confirm")->assertOk();

        $this->patchJson("/api/products/{$product->id}", ['is_active' => false])
            ->assertUnprocessable()->assertJsonValidationErrors('is_active');
        $this->deleteJson("/api/products/{$product->id}")
            ->assertUnprocessable()->assertJsonValidationErrors('product');
        $this->assertDatabaseHas('products', ['id' => $product->id, 'is_active' => true]);
        $this->assertDatabaseHas('order_items', ['order_id' => $order->id, 'product_id' => $product->id]);
    }

    public function test_fulfillment_rolls_back_movements_and_reservations_when_a_line_fails(): void
    {
        $this->userWithSalesPermissions();
        $customer = Customer::factory()->create();
        $firstProduct = Product::factory()->create();
        $secondProduct = Product::factory()->create();
        $this->setStock($firstProduct, 5);
        $this->setStock($secondProduct, 5);
        $order = $this->makeOrder($customer, [
            ['product_id' => $firstProduct->id, 'quantity' => 2, 'unit_price' => 4],
            ['product_id' => $secondProduct->id, 'quantity' => 2, 'unit_price' => 4],
        ]);
        $this->postJson("/api/orders/{$order->id}/confirm")->assertOk();
        $this->postJson("/api/orders/{$order->id}/process")->assertOk();

        DB::unprepared("CREATE TRIGGER reject_second_sales_movement BEFORE INSERT ON inventory_movements WHEN NEW.product_id = {$secondProduct->id} BEGIN SELECT RAISE(ABORT, 'rejected sales movement'); END");
        $this->withoutExceptionHandling();
        try {
            $this->postJson("/api/orders/{$order->id}/complete");
            $this->fail('The inventory movement trigger should abort fulfillment.');
        } catch (QueryException) {
            $this->assertDatabaseCount('inventory_movements', 0);
            $this->assertDatabaseHas('stock_balances', ['product_id' => $firstProduct->id, 'quantity_on_hand' => 5]);
            $this->assertDatabaseHas('stock_balances', ['product_id' => $secondProduct->id, 'quantity_on_hand' => 5]);
            $this->assertDatabaseCount('stock_reservations', 2);
            $this->assertSame(2, StockReservation::query()->where('status', 'reserved')->count());
        }
    }

    public function test_customer_and_order_routes_enforce_permissions(): void
    {
        $this->actingAs(User::factory()->create());
        $this->getJson('/api/customers')->assertForbidden();
        $this->postJson('/api/orders', [])->assertForbidden();
    }

    private function userWithSalesPermissions(): User
    {
        $user = User::factory()->create();
        $role = Role::factory()->create();
        $permissions = collect([
            'customers.view',
            'customers.manage',
            'orders.view',
            'orders.manage',
            'products.view',
            'products.manage',
        ])->map(fn (string $slug) => Permission::factory()->create([
            'name' => $slug,
            'slug' => $slug,
        ]));
        $role->permissions()->sync($permissions->pluck('id'));
        $user->update(['role_id' => $role->id]);

        $this->actingAs($user->refresh());

        return $user->refresh();
    }

    private function makeOrder(Customer $customer, array $items, array $totals = []): \App\Models\Order
    {
        $response = $this->postJson('/api/orders', [
            'customer_id' => $customer->id,
            'order_date' => now()->toDateString(),
            'discount_amount' => $totals['discount_amount'] ?? 0,
            'tax' => $totals['tax'] ?? 0,
            'subtotal' => $totals['spoof_subtotal'] ?? 99999,
            'total' => $totals['spoof_total'] ?? 99999,
            'items' => $items,
        ])->assertCreated();

        return \App\Models\Order::query()->findOrFail($response->json('id'))->load('items');
    }

    private function setStock(Product $product, int $quantity): void
    {
        StockBalance::query()->create([
            'product_id' => $product->id,
            'quantity_on_hand' => $quantity,
            'updated_at' => now(),
        ]);
    }
}
