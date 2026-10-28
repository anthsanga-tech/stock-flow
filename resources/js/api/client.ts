import axios from 'axios';

export const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || window.location.origin,
    withCredentials: true,
    withXSRFToken: true,
    headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    },
});

export interface LaravelValidationResponse {
    message?: string;
    errors?: Record<string, string[]>;
}

export function getErrorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError<LaravelValidationResponse>(error)) {
        const message = error.response?.data?.message;
        if (message && error.response?.status !== 422) {
            return message;
        }
    }

    return fallback;
}

export function getValidationErrors(error: unknown): Record<string, string[]> {
    if (!axios.isAxiosError<LaravelValidationResponse>(error)) {
        return {};
    }

    return error.response?.data?.errors ?? {};
}
