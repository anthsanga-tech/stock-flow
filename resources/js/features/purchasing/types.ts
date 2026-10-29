import type { PaginatedResponse } from '../products/types';

export interface Supplier {
    id: number;
    supplier_code: string;
    name: string;
    contact_person: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
    is_active: boolean;
    purchase_orders_count?: number;
    outstanding_purchase_orders_count?: number;
    purchase_orders?: PurchaseOrderSummary[];
    created_at: string | null;
    updated_at: string | null;
}

export interface PurchaseOrderItem {
    id: number;
    product_id: number;
    sku_snapshot: string;
    name_snapshot: string;
    quantity: number;
    received_quantity: number;
    outstanding_quantity?: number;
    unit_cost: string;
    line_subtotal: string;
    product?: { id: number; sku: string; name: string };
}

export interface PurchaseOrderSummary {
    id: number;
    order_number: string;
    supplier_id: number;
    order_date: string;
    expected_delivery_date: string | null;
    status: 'draft' | 'submitted' | 'approved' | 'partially_received' | 'received' | 'cancelled';
    subtotal: string;
    total: string;
    supplier?: Supplier;
    items?: PurchaseOrderItem[];
    items_count?: number;
    created_by?: number | null;
    notes?: string | null;
    status_history?: Array<{
        id: number;
        from_status: string | null;
        to_status: string;
        created_at: string;
        changer?: { id: number; name: string } | null;
    }>;
    receipts?: GoodsReceipt[];
}

export interface PurchaseOrder extends PurchaseOrderSummary {
    supplier: Supplier;
    items: PurchaseOrderItem[];
    receipts: GoodsReceipt[];
}

export interface GoodsReceipt {
    id: number;
    receipt_number: string;
    purchase_order_id: number | null;
    supplier_id: number;
    received_at: string | null;
    delivery_reference: string | null;
    notes: string | null;
    created_by: number | null;
    items_count?: number;
    supplier?: Supplier;
    purchase_order?: PurchaseOrderSummary | null;
    creator?: { id: number; name: string } | null;
    items?: Array<{
        id: number;
        purchase_order_item_id: number | null;
        product_id: number;
        sku_snapshot: string | null;
        name_snapshot: string | null;
        quantity: number;
        unit_cost: string;
        product?: { id: number; sku: string; name: string };
    }>;
}

export interface SupplierFilters {
    search?: string;
    status?: 'active' | 'inactive';
    sort_by: 'supplier_code' | 'name' | 'created_at' | 'id';
    sort_direction: 'asc' | 'desc';
    page: number;
    per_page: number;
}

export interface PurchaseOrderFilters {
    search?: string;
    supplier_id?: number;
    status?: PurchaseOrderSummary['status'];
    order_from?: string;
    order_to?: string;
    expected_from?: string;
    expected_to?: string;
    sort_by?: 'order_number' | 'order_date' | 'expected_delivery_date' | 'total' | 'status' | 'id';
    sort_direction?: 'asc' | 'desc';
    page: number;
    per_page: number;
}

export interface ReceiptFilters {
    supplier_id?: number;
    purchase_order_id?: number;
    from?: string;
    to?: string;
    reference?: string;
    search?: string;
    page: number;
    per_page: number;
}

export interface SupplierPayload {
    supplier_code: string;
    name: string;
    contact_person?: string;
    email?: string;
    phone?: string;
    address?: string;
    notes?: string;
    is_active: boolean;
}

export interface PurchaseOrderPayload {
    supplier_id: number;
    order_date: string;
    expected_delivery_date?: string | null;
    notes?: string;
    items: Array<{ product_id: number; quantity: number; unit_cost: number }>;
}

export type SupplierPageResponse = PaginatedResponse<Supplier>;
export type PurchaseOrderPageResponse = PaginatedResponse<PurchaseOrderSummary>;
export type ReceiptPageResponse = PaginatedResponse<GoodsReceipt>;
