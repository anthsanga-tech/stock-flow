import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SupplierListPage } from './SupplierListPage';
import { SupplierDetailsPage } from './SupplierDetailsPage';
import { PurchaseOrderFormPage } from './PurchaseOrderFormPage';
import { ReceiveGoodsPage } from './ReceiveGoodsPage';
import type { PurchaseOrder } from './types';
import type { GoodsReceipt } from './types';
import { createPurchaseOrder, getPurchaseOrder, getPurchaseOrders, getSupplier, getSupplierPurchaseOrders, getSuppliers, receiveGoods } from './api';
import { getProducts } from '../products/api';

vi.mock('./api', () => ({
    createPurchaseOrder: vi.fn(),
    deactivateSupplier: vi.fn(),
    getPurchaseOrder: vi.fn(),
    getPurchaseOrders: vi.fn(),
    getSupplier: vi.fn(),
    getSupplierPurchaseOrders: vi.fn(),
    getSuppliers: vi.fn(),
    receiveGoods: vi.fn(),
}));

vi.mock('../products/api', () => ({
    getProducts: vi.fn(),
}));

vi.mock('../../auth/AuthProvider', () => ({
    useAuth: () => ({ user: { permissions: ['suppliers.view', 'suppliers.manage'] } }),
}));

const supplier = {
    id: 8,
    supplier_code: 'SUP-08',
    name: 'Northstar Supply',
    contact_person: 'Morgan Lee',
    email: 'morgan@example.test',
    phone: '555-0108',
    address: null,
    notes: null,
    is_active: true,
    purchase_orders_count: 2,
    created_at: null,
    updated_at: null,
};

const productsResponse = {
    current_page: 1,
    data: [{
        id: 3,
        sku: 'PEN-03',
        name: 'Blue pen',
        category_id: 1,
        unit: 'box',
        cost_price: '1.25',
        selling_price: '2.50',
        reorder_level: 5,
        is_active: true,
    }],
    last_page: 1,
    per_page: 100,
    total: 1,
};

function renderPage(element: React.ReactNode, initialEntries = ['/']) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={initialEntries}>
                <Routes>
                    <Route path="/purchase-orders/:id/receive" element={element} />
                    <Route path="/suppliers/:id" element={element} />
                    <Route path="*" element={element} />
                </Routes>
            </MemoryRouter>
        </QueryClientProvider>,
    );
}

describe('purchasing pages', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getSuppliers).mockResolvedValue({
            current_page: 1,
            data: [supplier],
            last_page: 1,
            per_page: 15,
            total: 1,
        });
        vi.mocked(getProducts).mockResolvedValue(productsResponse);
        vi.mocked(getPurchaseOrders).mockResolvedValue({
            current_page: 1,
            data: [],
            last_page: 1,
            per_page: 15,
            total: 0,
        });
        vi.mocked(getPurchaseOrder).mockResolvedValue({
            id: 22,
            order_number: 'PO-22',
            supplier_id: supplier.id,
            supplier,
            order_date: '2026-10-29',
            expected_delivery_date: null,
            status: 'approved',
            subtotal: '5.00',
            total: '5.00',
            items: [{
                id: 31,
                product_id: 3,
                sku_snapshot: 'PEN-03',
                name_snapshot: 'Blue pen',
                quantity: 5,
                received_quantity: 0,
                unit_cost: '1.00',
                line_subtotal: '5.00',
            }],
            receipts: [],
        });
    });

    it('renders supplier contacts, active status, and order count', async () => {
        renderPage(<SupplierListPage />);

        expect(await screen.findByText('Northstar Supply')).toBeInTheDocument();
        expect(screen.getByText('SUP-08')).toBeInTheDocument();
        const row = screen.getByRole('row', { name: /Northstar Supply/ });
        expect(row.querySelector('.status-badge')).toHaveTextContent('Active');
        expect(row).toHaveTextContent('2');
    });

    it('shows a back-to-suppliers button on supplier details', async () => {
        vi.mocked(getSupplier).mockResolvedValue(supplier);
        vi.mocked(getSupplierPurchaseOrders).mockResolvedValue({
            current_page: 1,
            data: [],
            last_page: 1,
            per_page: 15,
            total: 0,
        });
        renderPage(<SupplierDetailsPage />, ['/suppliers/8']);

        expect(await screen.findByRole('button', { name: 'Back to suppliers' })).toBeInTheDocument();
    });

    it('preselects the supplier when creating an order from supplier details', async () => {
        const user = userEvent.setup();
        vi.mocked(getSupplier).mockResolvedValue(supplier);
        vi.mocked(getSupplierPurchaseOrders).mockResolvedValue({
            current_page: 1,
            data: [],
            last_page: 1,
            per_page: 15,
            total: 0,
        });
        render(
            <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
                <MemoryRouter initialEntries={['/suppliers/8']}>
                    <Routes>
                        <Route path="/suppliers/:id" element={<SupplierDetailsPage />} />
                        <Route path="/purchase-orders/new" element={<PurchaseOrderFormPage mode="create" />} />
                    </Routes>
                </MemoryRouter>
            </QueryClientProvider>,
        );

        await user.click(await screen.findByRole('button', { name: 'Create purchase order' }));
        await waitFor(() => expect(screen.getByLabelText('Supplier')).toHaveValue('8'));
    });

    it('calculates a draft total and prevents duplicate submission while saving', async () => {
        const user = userEvent.setup();
        let finishRequest: ((value: PurchaseOrder) => void) | undefined;
        vi.mocked(createPurchaseOrder).mockImplementation(() => new Promise<PurchaseOrder>((resolve) => {
            finishRequest = resolve;
        }));
        renderPage(<PurchaseOrderFormPage mode="create" />);

        await user.selectOptions(await screen.findByLabelText('Supplier'), '8');
        await user.selectOptions(screen.getByLabelText('Product'), '3');
        await user.clear(screen.getByLabelText('Quantity'));
        await user.type(screen.getByLabelText('Quantity'), '4');
        expect(screen.getByText('Estimated total').parentElement).toHaveTextContent('5.00');

        const saveButton = screen.getByRole('button', { name: 'Save draft' });
        await user.click(saveButton);
        await waitFor(() => expect(createPurchaseOrder).toHaveBeenCalledWith(expect.objectContaining({
            supplier_id: 8,
            items: [{ product_id: 3, quantity: 4, unit_cost: 1.25 }],
        })));
        expect(saveButton).toBeDisabled();
        finishRequest?.({
            id: 22,
            order_number: 'PO-22',
            supplier_id: supplier.id,
            supplier,
            order_date: '2026-10-29',
            expected_delivery_date: null,
            status: 'draft',
            subtotal: '5.00',
            total: '5.00',
            items: [],
            receipts: [],
        });
    });

    it('sends an idempotent partial receipt once and disables repeat submission', async () => {
        const user = userEvent.setup();
        let finishRequest: ((value: GoodsReceipt) => void) | undefined;
        vi.stubGlobal('crypto', { randomUUID: () => '1f3a5cc0-4288-4b2d-8650-89301cf93dcf' });
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        vi.mocked(receiveGoods).mockImplementation(() => new Promise<GoodsReceipt>((resolve) => {
            finishRequest = resolve;
        }));
        renderPage(<ReceiveGoodsPage />, ['/purchase-orders/22/receive']);

        const quantity = await screen.findByRole('spinbutton', { name: 'Quantity received for Blue pen' });
        await user.clear(quantity);
        await user.type(quantity, '2');
        const confirmButton = screen.getByRole('button', { name: 'Confirm receipt' });
        await user.click(confirmButton);
        await waitFor(() => expect(receiveGoods).toHaveBeenCalledWith(22, expect.objectContaining({
            idempotency_key: '1f3a5cc0-4288-4b2d-8650-89301cf93dcf',
            items: [{ purchase_order_item_id: 31, quantity: 2 }],
        })));
        expect(confirmButton).toBeDisabled();
        finishRequest?.({
            id: 44,
            receipt_number: 'GR-44',
            purchase_order_id: 22,
            supplier_id: 8,
            received_at: '2026-10-30',
            delivery_reference: 'DN-44',
            notes: null,
            created_by: 1,
            items: [],
        });
    });
});
