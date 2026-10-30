import { apiClient } from '../../api/client';
import type {
    Customer,
    CustomerFilters,
    CustomerPage,
    CustomerPayload,
    SalesOrder,
    SalesOrderFilters,
    SalesOrderPage,
    SalesOrderPayload,
    SalesProduct,
} from './types';

export async function getCustomers(filters: CustomerFilters): Promise<CustomerPage> {
    return (await apiClient.get<CustomerPage>('/api/customers', { params: filters })).data;
}

export async function getCustomer(id: number): Promise<Customer> {
    return (await apiClient.get<Customer>(`/api/customers/${id}`)).data;
}

export async function createCustomer(payload: CustomerPayload): Promise<Customer> {
    return (await apiClient.post<Customer>('/api/customers', payload)).data;
}

export async function updateCustomer(id: number, payload: CustomerPayload): Promise<Customer> {
    return (await apiClient.put<Customer>(`/api/customers/${id}`, payload)).data;
}

export async function deleteCustomer(id: number): Promise<void> {
    await apiClient.delete(`/api/customers/${id}`);
}

export async function getSalesOrders(filters: SalesOrderFilters): Promise<SalesOrderPage> {
    return (await apiClient.get<SalesOrderPage>('/api/orders', { params: filters })).data;
}

export async function getSalesOrder(id: number): Promise<SalesOrder> {
    return (await apiClient.get<SalesOrder>(`/api/orders/${id}`)).data;
}

export async function getSalesProducts(search?: string): Promise<SalesProduct[]> {
    const response = await apiClient.get<{ data: SalesProduct[] }>('/api/orders/products', {
        params: { per_page: 100, ...(search ? { search } : {}) },
    });
    return response.data.data;
}

export async function createSalesOrder(payload: SalesOrderPayload): Promise<SalesOrder> {
    return (await apiClient.post<SalesOrder>('/api/orders', payload)).data;
}

export async function updateSalesOrder(id: number, payload: SalesOrderPayload): Promise<SalesOrder> {
    return (await apiClient.put<SalesOrder>(`/api/orders/${id}`, payload)).data;
}

export async function transitionSalesOrder(
    id: number,
    action: 'confirm' | 'process' | 'complete' | 'cancel',
): Promise<SalesOrder> {
    return (await apiClient.post<SalesOrder>(`/api/orders/${id}/${action}`)).data;
}
