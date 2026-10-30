import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { Button, Card, EmptyState, ErrorState, Icon, LoadingState, PageHeader, Pagination, SelectInput, TextInput } from '../../components/ui';
import { getSalesOrders, transitionSalesOrder } from './api';
import type { SalesOrderFilters, SalesOrderStatus } from './types';

const money = (value: string) => Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const statusClass: Record<SalesOrderStatus, string> = {
    draft: 'status-badge--neutral',
    confirmed: 'status-badge--info',
    processing: 'status-badge--warning',
    completed: 'status-badge--success',
    cancelled: 'status-badge--neutral',
};

export function SalesOrderListPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const canManage = Boolean(user?.permissions.includes('orders.manage'));
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [customerId] = useState(() => {
        const value = Number(searchParams.get('customer_id'));
        return Number.isInteger(value) && value > 0 ? value : undefined;
    });
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [sortBy, setSortBy] = useState<SalesOrderFilters['sort_by']>('order_date');
    const [sortDirection, setSortDirection] = useState<SalesOrderFilters['sort_direction']>('desc');
    const [page, setPage] = useState(1);
    const [actionError, setActionError] = useState<string | null>(null);

    useEffect(() => {
        const timer = window.setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 250);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    const filters = useMemo<SalesOrderFilters>(() => ({
        ...(search ? { search } : {}),
        ...(customerId ? { customer_id: customerId } : {}),
        ...(status ? { status: status as SalesOrderStatus } : {}),
        ...(from ? { order_from: from } : {}),
        ...(to ? { order_to: to } : {}),
        sort_by: sortBy,
        sort_direction: sortDirection,
        page,
        per_page: 15,
    }), [search, customerId, status, from, to, sortBy, sortDirection, page]);
    const ordersQuery = useQuery({ queryKey: ['sales-orders', filters], queryFn: () => getSalesOrders(filters) });
    const transitionMutation = useMutation({
        mutationFn: ({ id, action }: { id: number; action: 'confirm' | 'process' | 'complete' | 'cancel' }) => transitionSalesOrder(id, action),
        onSuccess: async (order) => {
            setActionError(null);
            await queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
            await queryClient.invalidateQueries({ queryKey: ['sales-order', order.id] });
        },
        onError: (error: unknown) => setActionError(getErrorMessage(error, 'The order status could not be changed.')),
    });
    const orders = ordersQuery.data?.data ?? [];

    return (
        <>
            <PageHeader title="Sales orders" description="Create customer orders and track fulfillment from reservation to completion." eyebrow="SALES" actions={canManage ? <Button onClick={() => navigate('/orders/new')}><Icon name="plus" size={17} /> Create order</Button> : undefined} />
            {actionError && <div className="notice notice--error" role="alert">{actionError}</div>}
            <Card className="product-list-card">
                <div className="list-toolbar">
                    <div className="list-toolbar__heading"><h2>Order register</h2><span>{ordersQuery.data?.total ?? '—'} orders</span></div>
                    <div className="filter-bar sales-order-filter-bar" role="search">
                        <label className="search-field"><Icon name="search" size={17} /><span className="sr-only">Search sales orders</span><TextInput aria-label="Search sales orders" placeholder="Search order number or customer" type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} /></label>
                        <SelectInput aria-label="Filter sales orders by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                            <option value="">All statuses</option><option value="draft">Draft</option><option value="confirmed">Confirmed</option><option value="processing">Processing</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                        </SelectInput>
                        <label className="filter-date">From <TextInput aria-label="Order date from" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label>
                        <label className="filter-date">To <TextInput aria-label="Order date to" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label>
                        <SelectInput aria-label="Sort sales orders" value={`${sortBy}:${sortDirection}`} onChange={(event) => {
                            const [field, direction] = event.target.value.split(':') as [SalesOrderFilters['sort_by'], SalesOrderFilters['sort_direction']];
                            setSortBy(field); setSortDirection(direction); setPage(1);
                        }}>
                            <option value="order_date:desc">Newest first</option><option value="order_date:asc">Oldest first</option><option value="total:desc">Highest total</option><option value="order_number:asc">Order number</option>
                        </SelectInput>
                    </div>
                </div>
                {ordersQuery.isPending ? <LoadingState label="Loading sales orders…" /> : ordersQuery.isError ? (
                    <ErrorState title="Sales orders could not be loaded" message={getErrorMessage(ordersQuery.error, 'Check your connection and try again.')} action={<Button onClick={() => void ordersQuery.refetch()}>Try again</Button>} />
                ) : orders.length === 0 ? (
                    <EmptyState title={search || status || from || to ? 'No orders match these filters' : 'No sales orders yet'} message="Create a sales order to begin customer fulfillment." action={canManage ? <Button onClick={() => navigate('/orders/new')}>Create order</Button> : undefined} />
                ) : (
                    <>
                        <div className="table-scroll sales-table-scroll"><table className="product-table">
                            <thead><tr><th>Order</th><th>Customer</th><th>Order date</th><th>Total</th><th>Status</th><th>Created by</th><th>Actions</th></tr></thead>
                            <tbody>{orders.map((order) => <tr key={order.id}>
                                <td><strong>{order.order_number}</strong><small>{order.items_count ?? 0} items</small></td>
                                <td>{order.customer?.name ?? '—'}</td><td>{order.order_date}</td><td>{money(order.total)}</td>
                                <td><span className={`status-badge ${statusClass[order.status]}`}>{order.status}</span></td><td>{order.creator?.name ?? '—'}</td>
                                <td className="table-actions"><Link to={`/orders/${order.id}`}>View</Link>{canManage && order.status === 'draft' && <Link to={`/orders/${order.id}/edit`}>Edit</Link>}{canManage && order.status === 'draft' && <Button size="small" variant="quiet" disabled={transitionMutation.isPending} onClick={() => {
                                    if (window.confirm(`Confirm ${order.order_number} and reserve stock?`)) transitionMutation.mutate({ id: order.id, action: 'confirm' });
                                }}>Confirm</Button>}</td>
                            </tr>)}</tbody>
                        </table></div>
                        <Pagination page={ordersQuery.data.current_page} lastPage={ordersQuery.data.last_page} total={ordersQuery.data.total} itemLabel="sales order" onPageChange={setPage} />
                    </>
                )}
            </Card>
        </>
    );
}
