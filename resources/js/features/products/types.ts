export interface Category {
    id: number;
    name: string;
    slug: string;
    is_active: boolean;
}

export interface StockBalance {
    product_id: number;
    quantity_on_hand: number;
    updated_at: string;
}

export interface Product {
    id: number;
    sku: string;
    name: string;
    category_id: number;
    unit: string;
    cost_price: string;
    selling_price: string;
    reorder_level: number;
    is_active: boolean;
    category?: Category | null;
    stock_balance?: StockBalance | null;
}

export interface PaginatedResponse<T> {
    current_page: number;
    data: T[];
    last_page: number;
    per_page: number;
    total: number;
}

export interface ProductFilters {
    search?: string;
    category_id?: number;
    is_active?: 0 | 1;
    sort_by: 'sku' | 'name' | 'cost_price' | 'selling_price' | 'reorder_level' | 'id';
    sort_direction: 'asc' | 'desc';
    page: number;
    per_page: number;
}

export interface ProductPayload {
    sku: string;
    name: string;
    category_id: number;
    unit: string;
    cost_price: number;
    selling_price: number;
    reorder_level: number;
    is_active: boolean;
}
