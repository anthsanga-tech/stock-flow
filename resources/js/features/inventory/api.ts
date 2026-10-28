import { apiClient } from '../../api/client';
import type {
    InventoryFilters,
    InventoryMovement,
    InventoryResponse,
    MovementFilters,
    MovementPayload,
} from './types';
import type { PaginatedResponse } from '../products/types';

export async function getInventory(filters: InventoryFilters): Promise<InventoryResponse> {
    const response = await apiClient.get<InventoryResponse>('/api/inventory', { params: filters });
    return response.data;
}

export async function getMovements(filters: MovementFilters): Promise<PaginatedResponse<InventoryMovement>> {
    const response = await apiClient.get<PaginatedResponse<InventoryMovement>>('/api/inventory-movements', {
        params: filters,
    });
    return response.data;
}

export async function createMovement(payload: MovementPayload): Promise<InventoryMovement> {
    const response = await apiClient.post<InventoryMovement>('/api/inventory-movements', payload);
    return response.data;
}
