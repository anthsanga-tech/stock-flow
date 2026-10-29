<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->string('supplier_code')->nullable()->unique();
            $table->string('contact_person')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        foreach (DB::table('suppliers')->whereNull('supplier_code')->orderBy('id')->get(['id']) as $supplier) {
            DB::table('suppliers')->where('id', $supplier->id)->update([
                'supplier_code' => 'SUP-'.str_pad((string) $supplier->id, 6, '0', STR_PAD_LEFT),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropUnique(['supplier_code']);
            $table->dropColumn(['supplier_code', 'contact_person', 'notes', 'created_at', 'updated_at']);
        });
    }
};
