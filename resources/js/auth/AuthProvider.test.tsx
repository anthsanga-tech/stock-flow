import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../api/client';
import { AuthProvider, useAuth } from './AuthProvider';

vi.mock('../api/client', () => ({
    apiClient: {
        get: vi.fn(),
        post: vi.fn(),
        interceptors: {
            response: {
                use: vi.fn(() => 1),
                eject: vi.fn(),
            },
        },
    },
}));

function AuthStateProbe() {
    const { status, user } = useAuth();

    return <div>{status}:{user ? user.email : 'anonymous'}</div>;
}

describe('AuthProvider', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('treats forbidden session checks as a guest state', async () => {
        vi.mocked(apiClient.get).mockRejectedValue(Object.assign(new Error('Forbidden'), {
            response: { status: 403 },
        }));

        render(
            <AuthProvider>
                <AuthStateProbe />
            </AuthProvider>,
        );

        await waitFor(() => {
            expect(screen.getByText('guest:anonymous')).toBeInTheDocument();
        });
    });
});
