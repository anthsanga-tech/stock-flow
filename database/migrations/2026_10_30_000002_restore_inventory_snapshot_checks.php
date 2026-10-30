<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            return;
        }

        DB::unprepared(<<<'SQL'
            CREATE TRIGGER IF NOT EXISTS inventory_movements_snapshot_integrity_insert
            BEFORE INSERT ON inventory_movements
            WHEN (NEW.quantity_before IS NOT NULL AND (typeof(NEW.quantity_before) <> 'integer' OR NEW.quantity_before < 0))
              OR (NEW.quantity_after IS NOT NULL AND (typeof(NEW.quantity_after) <> 'integer' OR NEW.quantity_after < 0))
            BEGIN
                SELECT RAISE(ABORT, 'Inventory movement snapshots must be non-negative integers or NULL.');
            END
            SQL);

        DB::unprepared(<<<'SQL'
            CREATE TRIGGER IF NOT EXISTS inventory_movements_snapshot_integrity_update
            BEFORE UPDATE OF quantity_before, quantity_after ON inventory_movements
            WHEN (NEW.quantity_before IS NOT NULL AND (typeof(NEW.quantity_before) <> 'integer' OR NEW.quantity_before < 0))
              OR (NEW.quantity_after IS NOT NULL AND (typeof(NEW.quantity_after) <> 'integer' OR NEW.quantity_after < 0))
            BEGIN
                SELECT RAISE(ABORT, 'Inventory movement snapshots must be non-negative integers or NULL.');
            END
            SQL);
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'sqlite') {
            return;
        }

        DB::unprepared('DROP TRIGGER IF EXISTS inventory_movements_snapshot_integrity_insert');
        DB::unprepared('DROP TRIGGER IF EXISTS inventory_movements_snapshot_integrity_update');
    }
};
