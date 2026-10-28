import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryPage } from './InventoryPage';
import { MovementHistoryPage } from './MovementHistoryPage';
import { createMovement, getInventory, getMovements } from './api';
import type { InventoryMovement, InventoryResponse } from './types';
import { StockOperationsPage } from './StockOperationsPage';

vi.mock('./api', () => ({
    createMovement: vi.fn(),
    getInventory: vi.fn(),
    getMovements: vi.fn(),
}));

vi.mock('../products/api', () => ({
    getCategories: vi.fn().mockResolvedValue({
        current_page: 1,
        data: [],
        last_page: 1,
        per_page: 100,
        total: 0,
    }),
}));

const inventory: InventoryResponse = {
    current_page: 1,
    data: [{
        id: 4,
        sku: 'PART-04',
        name: 'Copper Cable',
        category_id: 2,
        unit: 'pcs',
        cost_price: '2.00',
        selling_price: '3.50',
        reorder_level: 5,
        is_active: true,
        quantity_on_hand: 3,
        stock_balance: { product_id: 4, quantity_on_hand: 3, updated_at: '2026-10-28T10:00:00Z' },
        category: { id: 2, name: 'Parts', slug: 'parts', is_active: true },
    }],
    last_page: 1,
    per_page: 15,
    total: 1,
    active_products_count: 7,
    low_stock_count: 2,
};

const movement: InventoryMovement = {
    id: 11,
    product_id: 4,
    movement_type: 'inbound',
    quantity_delta: 3,
    quantity_before: 0,
    quantity_after: 3,
    reference_type: null,
    reference_id: null,
    reason: 'Opening stock',
    created_by: 1,
    created_at: '2026-10-28T10:00:00Z',
    product: inventory.data[0],
    creator: { id: 1, name: 'Avery', email: 'avery@example.test' },
};

function renderPage(page: React.ReactNode, initialEntries = ['/']) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={initialEntries}>{page}</MemoryRouter>
        </QueryClientProvider>,
    );
}

describe('inventory pages', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getInventory).mockResolvedValue(inventory);
        vi.mocked(getMovements).mockResolvedValue({
            current_page: 1,
            data: [movement],
            last_page: 1,
            per_page: 15,
            total: 1,
        });
        vi.mocked(createMovement).mockResolvedValue(movement);
    });

    it('loads inventory, highlights low stock, and sends search and status filters', async () => {
        const user = userEvent.setup();
        const { container } = renderPage(<InventoryPage />);

        expect((await screen.findAllByText('Copper Cable')).length).toBeGreaterThan(0);
        expect(container.querySelector('.inventory-status--out')).not.toBeInTheDocument();
        expect(container.querySelector('.inventory-status--low')).toBeInTheDocument();
        expect(screen.getByText('7', { selector: 'strong' })).toBeInTheDocument();

        await user.type(screen.getByRole('searchbox', { name: 'Search inventory by name or SKU' }), 'copper');
        await waitFor(() => {
            expect(vi.mocked(getInventory)).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'copper' }));
        });
        await user.selectOptions(screen.getByLabelText('Filter inventory by stock status'), 'low_stock');
        await waitFor(() => {
            expect(vi.mocked(getInventory)).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'low_stock' }));
        });
    });

    it('submits a stock receipt once and reports the resulting balance', async () => {
        const user = userEvent.setup();
        let finishRequest: ((value: InventoryMovement) => void) | undefined;
        vi.mocked(createMovement).mockImplementation(() => new Promise((resolve) => {
            finishRequest = resolve;
        }));

        renderPage(<><StockOperationsPage /><MovementHistoryPage /></>);

        await user.selectOptions(await screen.findByLabelText('Product'), '4');
        await screen.findAllByText('Opening stock');
        await user.type(screen.getByLabelText('Quantity'), '6');
        const submit = screen.getByRole('button', { name: 'Confirm movement' });
        await user.click(submit);
        await user.click(submit);

        expect(createMovement).toHaveBeenCalledTimes(1);
        expect(vi.mocked(createMovement).mock.calls[0][0]).toEqual({
            product_id: 4,
            movement_type: 'inbound',
            quantity_delta: 6,
        });
        expect(submit).toBeDisabled();

        finishRequest?.({ ...movement, quantity_before: 3, quantity_after: 9 });
        expect(await screen.findByRole('status')).toHaveTextContent('New balance: 9 pcs.');
        await waitFor(() => {
            expect(getMovements).toHaveBeenCalledTimes(2);
            expect(getInventory).toHaveBeenCalledTimes(4);
        });
    });

    it('shows a useful error when stock could not be saved', async () => {
        const user = userEvent.setup();
        vi.mocked(createMovement).mockRejectedValue(new Error('Network failed'));
        renderPage(<StockOperationsPage />);

        await user.selectOptions(await screen.findByLabelText('Product'), '4');
        await user.type(screen.getByLabelText('Quantity'), '2');
        await user.click(screen.getByRole('button', { name: 'Confirm movement' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('The stock movement could not be saved.');
    });

    it('renders filtered movement history with before/after balances', async () => {
        renderPage(<MovementHistoryPage />, ['/inventory/movements?product_id=4']);

        expect((await screen.findAllByText('Opening stock')).length).toBeGreaterThan(0);
        expect(screen.getByText('0 → 3')).toBeInTheDocument();
        expect((await screen.findAllByText('Avery')).length).toBeGreaterThan(0);
        expect(vi.mocked(getMovements).mock.calls[0][0]).toEqual(expect.objectContaining({ product_id: 4 }));
    });

    it('provides a back-to-inventory link from movement history', () => {
        vi.mocked(getInventory).mockImplementation(() => new Promise(() => undefined));
        vi.mocked(getMovements).mockImplementation(() => new Promise(() => undefined));
        renderPage(<MovementHistoryPage />);

        expect(screen.getByRole('link', { name: 'Back to inventory' })).toHaveAttribute('href', '/inventory');
    });

    it('renders an empty inventory state when there are no active products', async () => {
        vi.mocked(getInventory).mockResolvedValue({
            ...inventory,
            data: [],
            total: 0,
            active_products_count: 0,
            low_stock_count: 0,
        });
        renderPage(<InventoryPage />);

        expect(await screen.findByText('No active products to track')).toBeInTheDocument();
    });

    it('renders a loading state while inventory is being fetched', () => {
        vi.mocked(getInventory).mockImplementation(() => new Promise(() => undefined));
        renderPage(<InventoryPage />);

        expect(screen.getByRole('status')).toHaveTextContent('Loading inventory…');
    });
});
