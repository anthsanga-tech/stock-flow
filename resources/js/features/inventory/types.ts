import type { PaginatedResponse, Product, StockBalance } from '../products/types';

export interface InventoryProduct extends Product {
    quantity_on_hand: number;
    stock_balance?: StockBalance | null;
}

export interface InventoryResponse extends PaginatedResponse<InventoryProduct> {
    active_products_count: number;
    low_stock_count: number;
}

export interface InventoryFilters {
    search?: string;
    category_id?: number;
    status: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
    sort_by: 'name' | 'sku' | 'quantity_on_hand' | 'reorder_level';
    sort_direction: 'asc' | 'desc';
    page: number;
    per_page: number;
}

export type MovementType = 'inbound' | 'outbound' | 'adjustment';

export interface InventoryMovement {
    id: number;
    product_id: number;
    movement_type: MovementType;
    quantity_delta: number;
    quantity_before: number | null;
    quantity_after: number | null;
    reference_type: string | null;
    reference_id: number | null;
    reason: string | null;
    created_by: number | null;
    created_at: string;
    product: Product;
    creator: { id: number; name: string; email: string } | null;
}

export interface MovementFilters {
    product_id?: number;
    movement_type?: MovementType;
    from?: string;
    to?: string;
    page: number;
    per_page: number;
}

export interface MovementPayload {
    product_id: number;
    movement_type: MovementType;
    quantity_delta: number;
    reason?: string;
}
