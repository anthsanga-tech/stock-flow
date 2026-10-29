import { apiClient } from '../../api/client';
import type {
    GoodsReceipt,
    PurchaseOrder,
    PurchaseOrderFilters,
    PurchaseOrderPageResponse,
    PurchaseOrderPayload,
    ReceiptFilters,
    ReceiptPageResponse,
    Supplier,
    SupplierFilters,
    SupplierPageResponse,
    SupplierPayload,
} from './types';

export async function getSuppliers(filters: SupplierFilters): Promise<SupplierPageResponse> {
    return (await apiClient.get<SupplierPageResponse>('/api/suppliers', { params: filters })).data;
}

export async function getSupplier(id: number): Promise<Supplier> {
    return (await apiClient.get<Supplier>(`/api/suppliers/${id}`)).data;
}

export async function getSupplierPurchaseOrders(id: number, page = 1): Promise<PurchaseOrderPageResponse> {
    return (await apiClient.get<PurchaseOrderPageResponse>(`/api/suppliers/${id}/purchase-orders`, {
        params: { page, per_page: 10 },
    })).data;
}

export async function createSupplier(payload: SupplierPayload): Promise<Supplier> {
    return (await apiClient.post<Supplier>('/api/suppliers', payload)).data;
}

export async function updateSupplier(id: number, payload: SupplierPayload): Promise<Supplier> {
    return (await apiClient.put<Supplier>(`/api/suppliers/${id}`, payload)).data;
}

export async function deactivateSupplier(id: number): Promise<Supplier> {
    return (await apiClient.delete<Supplier>(`/api/suppliers/${id}`)).data;
}

export async function getPurchaseOrders(filters: PurchaseOrderFilters): Promise<PurchaseOrderPageResponse> {
    return (await apiClient.get<PurchaseOrderPageResponse>('/api/purchase-orders', { params: filters })).data;
}

export async function getPurchaseOrder(id: number): Promise<PurchaseOrder> {
    return (await apiClient.get<PurchaseOrder>(`/api/purchase-orders/${id}`)).data;
}

export async function createPurchaseOrder(payload: PurchaseOrderPayload): Promise<PurchaseOrder> {
    return (await apiClient.post<PurchaseOrder>('/api/purchase-orders', payload)).data;
}

export async function updatePurchaseOrder(id: number, payload: PurchaseOrderPayload): Promise<PurchaseOrder> {
    return (await apiClient.put<PurchaseOrder>(`/api/purchase-orders/${id}`, payload)).data;
}

export async function changePurchaseOrderStatus(
    id: number,
    action: 'submit' | 'approve' | 'cancel',
): Promise<PurchaseOrder> {
    return (await apiClient.post<PurchaseOrder>(`/api/purchase-orders/${id}/${action}`)).data;
}

export async function getGoodsReceipts(filters: ReceiptFilters): Promise<ReceiptPageResponse> {
    return (await apiClient.get<ReceiptPageResponse>('/api/goods-receipts', { params: filters })).data;
}

export async function getGoodsReceipt(id: number): Promise<GoodsReceipt> {
    return (await apiClient.get<GoodsReceipt>(`/api/goods-receipts/${id}`)).data;
}

export interface ReceiveGoodsPayload {
    idempotency_key: string;
    received_at: string;
    delivery_reference?: string;
    notes?: string;
    items: Array<{ purchase_order_item_id: number; quantity: number }>;
}

export async function receiveGoods(id: number, payload: ReceiveGoodsPayload): Promise<GoodsReceipt> {
    return (await apiClient.post<GoodsReceipt>(`/api/purchase-orders/${id}/receipts`, payload)).data;
}
