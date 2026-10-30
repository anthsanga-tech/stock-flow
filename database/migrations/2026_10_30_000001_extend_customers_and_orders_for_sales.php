<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->string('customer_code', 50)->nullable()->unique();
            $table->string('company_name')->nullable();
            $table->text('billing_address')->nullable();
            $table->text('shipping_address')->nullable();
            $table->text('notes')->nullable();
            $table->string('status', 20)->default('active')->index();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        foreach (DB::table('customers')->whereNull('customer_code')->orderBy('id')->get(['id', 'is_active']) as $customer) {
            DB::table('customers')->where('id', $customer->id)->update([
                'customer_code' => 'CUS-'.str_pad((string) $customer->id, 6, '0', STR_PAD_LEFT),
                'status' => $customer->is_active ? 'active' : 'inactive',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        Schema::table('orders', function (Blueprint $table) {
            $table->date('order_date')->nullable();
            $table->date('expected_delivery_date')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->index(['status', 'order_date']);
        });

        DB::table('orders')->whereNull('order_date')->update([
            'order_date' => now()->toDateString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        DB::table('orders')->where('status', 'pending')->update(['status' => 'draft']);

        Schema::table('order_items', function (Blueprint $table) {
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('stock_reservations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('sales_order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('sales_order_item_id')->unique()->constrained('order_items')->cascadeOnDelete();
            $table->foreignId('product_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('reserved_quantity');
            $table->string('status', 20)->default('reserved');
            $table->timestamps();
            $table->index(['product_id', 'status']);
            $table->index(['sales_order_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_reservations');

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn(['discount_amount', 'created_at', 'updated_at']);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['status', 'order_date']);
            $table->dropColumn(['order_date', 'expected_delivery_date', 'notes', 'created_at', 'updated_at']);
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->dropUnique(['customer_code']);
            $table->dropIndex(['status']);
            $table->dropColumn([
                'customer_code',
                'company_name',
                'billing_address',
                'shipping_address',
                'notes',
                'status',
                'created_at',
                'updated_at',
            ]);
        });
    }
};
