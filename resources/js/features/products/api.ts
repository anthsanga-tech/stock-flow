import { apiClient } from '../../api/client';
import type { Category, PaginatedResponse, Product, ProductFilters, ProductPayload } from './types';

export async function getProducts(filters: ProductFilters): Promise<PaginatedResponse<Product>> {
    const response = await apiClient.get<PaginatedResponse<Product>>('/api/products', {
        params: filters,
    });
    return response.data;
}

export async function getProduct(id: number): Promise<Product> {
    const response = await apiClient.get<Product>(`/api/products/${id}`);
    return response.data;
}

export async function getCategories(): Promise<PaginatedResponse<Category>> {
    const response = await apiClient.get<PaginatedResponse<Category>>('/api/categories', {
        params: { per_page: 100 },
    });
    return response.data;
}

export async function createProduct(payload: ProductPayload): Promise<Product> {
    const response = await apiClient.post<Product>('/api/products', payload);
    return response.data;
}

export async function updateProduct(id: number, payload: ProductPayload): Promise<Product> {
    const response = await apiClient.put<Product>(`/api/products/${id}`, payload);
    return response.data;
}

export async function archiveProduct(id: number): Promise<Product> {
    const response = await apiClient.patch<Product>(`/api/products/${id}`, { is_active: false });
    return response.data;
}
