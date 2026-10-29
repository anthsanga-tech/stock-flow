<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('purchase_orders')) {
            Schema::create('purchase_orders', function (Blueprint $table) {
                $table->id();
                $table->string('order_number')->unique();
                $table->foreignId('supplier_id')->constrained()->restrictOnDelete();
                $table->date('order_date');
                $table->date('expected_delivery_date')->nullable();
                $table->string('status')->default('draft')->index();
                $table->text('notes')->nullable();
                $table->decimal('subtotal', 12, 2)->default(0);
                $table->decimal('total', 12, 2)->default(0);
                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
                $table->index(['supplier_id', 'order_date']);
            });
        }

        if (! Schema::hasTable('purchase_order_items')) {
            Schema::create('purchase_order_items', function (Blueprint $table) {
                $table->id();
                $table->foreignId('purchase_order_id')->constrained()->restrictOnDelete();
                $table->foreignId('product_id')->constrained()->restrictOnDelete();
                $table->string('sku_snapshot');
                $table->string('name_snapshot');
                $table->unsignedInteger('quantity');
                $table->unsignedInteger('received_quantity')->default(0);
                $table->decimal('unit_cost', 12, 2);
                $table->decimal('line_subtotal', 12, 2);
                $table->timestamps();
                $table->unique(['purchase_order_id', 'product_id']);
            });
        }

        if (! Schema::hasTable('purchase_order_status_histories')) {
            Schema::create('purchase_order_status_histories', function (Blueprint $table) {
                $table->id();
                $table->foreignId('purchase_order_id')->constrained()->restrictOnDelete();
                $table->string('from_status')->nullable();
                $table->string('to_status');
                $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('created_at')->useCurrent();
                $table->index(['purchase_order_id', 'created_at'], 'po_status_history_order_created_idx');
            });
        }

        Schema::table('purchase_receipts', function (Blueprint $table) {
            $table->foreignId('purchase_order_id')->nullable()->after('supplier_id')
                ->constrained()->restrictOnDelete();
            $table->string('delivery_reference')->nullable();
            $table->text('notes')->nullable();
            $table->string('idempotency_key')->nullable()->unique();
            $table->string('request_hash', 64)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
            $table->index(['supplier_id', 'received_at'], 'purchase_receipts_supplier_received_idx');
        });

        Schema::table('purchase_receipt_items', function (Blueprint $table) {
            $table->foreignId('purchase_order_item_id')->nullable()
                ->constrained('purchase_order_items')->restrictOnDelete();
            $table->string('sku_snapshot')->nullable();
            $table->string('name_snapshot')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('purchase_receipt_items', function (Blueprint $table) {
            $table->dropForeign(['purchase_order_item_id']);
            $table->dropColumn(['purchase_order_item_id', 'sku_snapshot', 'name_snapshot']);
        });

        Schema::table('purchase_receipts', function (Blueprint $table) {
            $table->dropForeign(['purchase_order_id']);
            $table->dropUnique(['idempotency_key']);
            $table->dropIndex('purchase_receipts_supplier_received_idx');
            $table->dropColumn([
                'purchase_order_id',
                'delivery_reference',
                'notes',
                'idempotency_key',
                'request_hash',
                'created_at',
                'updated_at',
            ]);
        });

        Schema::dropIfExists('purchase_order_status_histories');
        Schema::dropIfExists('purchase_order_items');
        Schema::dropIfExists('purchase_orders');
    }
};
