import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';

vi.mock('../auth/AuthProvider', () => ({
    useAuth: () => ({
        user: {
            name: 'Avery Owner',
            email: 'avery@example.test',
            role: { id: 1, name: 'Owner', slug: 'owner' },
            permissions: ['products.view'],
        },
        logout: vi.fn(),
    }),
}));

function renderShell() {
    return render(
        <MemoryRouter>
            <AppShell>
                <button type="button">Page content action</button>
            </AppShell>
        </MemoryRouter>,
    );
}

describe('AppShell user menu', () => {
    it('keeps the menu open while focus moves inside it and closes when focus leaves', async () => {
        const user = userEvent.setup();
        renderShell();

        await user.click(screen.getByRole('button', { name: 'User menu for Avery Owner' }));
        expect(screen.getByRole('menu')).toBeInTheDocument();

        await user.tab();
        expect(screen.getByRole('menu')).toBeInTheDocument();
        expect(screen.getByRole('menuitem', { name: /sign out/i })).toHaveFocus();

        await user.tab();
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Page content action' })).toHaveFocus();
    });

    it('closes the menu with Escape', async () => {
        const user = userEvent.setup();
        renderShell();

        await user.click(screen.getByRole('button', { name: 'User menu for Avery Owner' }));
        expect(screen.getByRole('menu')).toBeInTheDocument();

        await user.keyboard('{Escape}');

        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
});