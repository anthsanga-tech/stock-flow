import type { PaginatedResponse } from '../products/types';

export type SalesOrderStatus = 'draft' | 'confirmed' | 'processing' | 'completed' | 'cancelled';

export interface Customer {
    id: number;
    customer_code: string;
    name: string;
    email: string | null;
    phone: string | null;
    company_name: string | null;
    billing_address: string | null;
    shipping_address: string | null;
    address?: string | null;
    notes: string | null;
    status: 'active' | 'inactive';
    is_active: boolean;
    orders_count?: number;
    orders_sum_total?: string | null;
    outstanding_orders_count?: number;
    orders?: SalesOrderSummary[];
    created_at: string | null;
    updated_at: string | null;
}

export interface SalesOrderItem {
    id: number;
    product_id: number;
    sku_snapshot: string;
    name_snapshot: string;
    quantity: number;
    unit_price: string;
    discount_amount: string;
    line_total: string;
    product?: SalesProduct;
    reservation?: { reserved_quantity: number; status: 'reserved' | 'released' | 'consumed' } | null;
}

export interface SalesOrderSummary {
    id: number;
    order_number: string;
    customer_id: number;
    order_date: string;
    expected_delivery_date: string | null;
    status: SalesOrderStatus;
    subtotal: string;
    discount: string;
    tax: string;
    total: string;
    notes?: string | null;
    created_by: number | null;
    customer?: Customer;
    creator?: { id: number; name: string } | null;
    items_count?: number;
}

export interface SalesOrder extends SalesOrderSummary {
    customer: Customer;
    items: SalesOrderItem[];
    status_history: Array<{
        id: number;
        from_status: string | null;
        to_status: string;
        created_at: string;
        changer?: { id: number; name: string } | null;
    }>;
}

export interface SalesProduct {
    id: number;
    sku: string;
    name: string;
    selling_price: string;
    stock_on_hand: number;
    reserved_quantity: number;
    available_quantity: number;
}

export interface CustomerFilters {
    search?: string;
    status?: 'active' | 'inactive';
    sort_by: 'customer_code' | 'name' | 'company_name' | 'created_at' | 'updated_at' | 'id';
    sort_direction: 'asc' | 'desc';
    page: number;
    per_page: number;
}

export interface SalesOrderFilters {
    search?: string;
    customer_id?: number;
    status?: SalesOrderStatus;
    order_from?: string;
    order_to?: string;
    sort_by: 'order_number' | 'order_date' | 'expected_delivery_date' | 'total' | 'status' | 'created_at' | 'id';
    sort_direction: 'asc' | 'desc';
    page: number;
    per_page: number;
}

export interface CustomerPayload {
    name: string;
    email?: string;
    phone?: string;
    company_name?: string;
    billing_address?: string;
    shipping_address?: string;
    notes?: string;
    status: 'active' | 'inactive';
}

export interface SalesOrderPayload {
    customer_id: number;
    order_date: string;
    expected_delivery_date?: string | null;
    discount_amount: number;
    tax: number;
    notes?: string;
    items: Array<{ product_id: number; quantity: number; unit_price: number; discount_amount: number }>;
}

export type CustomerPage = PaginatedResponse<Customer>;
export type SalesOrderPage = PaginatedResponse<SalesOrderSummary>;
