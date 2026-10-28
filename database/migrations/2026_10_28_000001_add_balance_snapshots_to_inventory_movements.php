<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->integer('quantity_before')->nullable()->after('quantity_delta');
            $table->integer('quantity_after')->nullable()->after('quantity_before');
            $table->index('created_at', 'inventory_movements_created_at_idx');
            $table->index(['product_id', 'created_at'], 'inventory_movements_product_created_idx');
            $table->index(['movement_type', 'created_at'], 'inventory_movements_type_created_idx');
            $table->index(['created_by', 'created_at'], 'inventory_movements_user_created_idx');
        });
    }

    public function down(): void
    {
        Schema::table('inventory_movements', function (Blueprint $table) {
            $table->dropIndex('inventory_movements_created_at_idx');
            $table->dropIndex('inventory_movements_product_created_idx');
            $table->dropIndex('inventory_movements_type_created_idx');
            $table->dropIndex('inventory_movements_user_created_idx');
            $table->dropColumn(['quantity_before', 'quantity_after']);
        });
    }
};
