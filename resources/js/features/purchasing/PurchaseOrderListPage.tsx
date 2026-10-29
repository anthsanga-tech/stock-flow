import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { Button, Card, EmptyState, ErrorState, Icon, LoadingState, PageHeader, SelectInput, TextInput } from '../../components/ui';
import { getPurchaseOrders, getSuppliers } from './api';
import type { PurchaseOrderFilters, PurchaseOrderSummary, SupplierFilters } from './types';
import { useAuth } from '../../auth/AuthProvider';

const statuses: PurchaseOrderSummary['status'][] = ['draft', 'submitted', 'approved', 'partially_received', 'received', 'cancelled'];

export function PurchaseOrderListPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const canManage = Boolean(user?.permissions.includes('suppliers.manage'));
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [supplierId, setSupplierId] = useState('');
    const [orderFrom, setOrderFrom] = useState('');
    const [orderTo, setOrderTo] = useState('');
    const [expectedFrom, setExpectedFrom] = useState('');
    const [expectedTo, setExpectedTo] = useState('');
    const [sortBy, setSortBy] = useState<NonNullable<PurchaseOrderFilters['sort_by']>>('id');
    const [sortDirection, setSortDirection] = useState<NonNullable<PurchaseOrderFilters['sort_direction']>>('desc');
    const [page, setPage] = useState(1);
    useEffect(() => {
        const timer = window.setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, 250);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    const supplierFilters: SupplierFilters = {
        sort_by: 'name', sort_direction: 'asc', page: 1, per_page: 100,
    };
    const supplierQuery = useQuery({
        queryKey: ['suppliers', supplierFilters],
        queryFn: () => getSuppliers(supplierFilters),
    });
    const filters = useMemo<PurchaseOrderFilters>(() => ({
        ...(search ? { search } : {}),
        ...(status ? { status: status as PurchaseOrderSummary['status'] } : {}),
        ...(supplierId ? { supplier_id: Number(supplierId) } : {}),
        ...(orderFrom ? { order_from: orderFrom } : {}),
        ...(orderTo ? { order_to: orderTo } : {}),
        ...(expectedFrom ? { expected_from: expectedFrom } : {}),
        ...(expectedTo ? { expected_to: expectedTo } : {}),
        sort_by: sortBy,
        sort_direction: sortDirection,
        page,
        per_page: 15,
    }), [search, status, supplierId, orderFrom, orderTo, expectedFrom, expectedTo, sortBy, sortDirection, page]);
    const ordersQuery = useQuery({
        queryKey: ['purchase-orders', filters],
        queryFn: () => getPurchaseOrders(filters),
    });
    const orders = ordersQuery.data?.data ?? [];

    return (
        <>
            <PageHeader
                title="Purchase orders"
                description="Create orders, track outstanding quantities, and receive supplier deliveries."
                eyebrow="PURCHASING"
                actions={canManage ? <Button onClick={() => navigate('/purchase-orders/new')}><Icon name="plus" size={17} /> Create purchase order</Button> : undefined}
            />
            <Card className="product-list-card purchasing-list-card">
                <div className="list-toolbar">
                    <div className="list-toolbar__heading"><h2>Orders</h2><span>{ordersQuery.data?.total ?? '—'} total</span></div>
                    <div className="filter-bar" role="search">
                        <label className="search-field">
                            <Icon name="search" size={17} /><span className="sr-only">Search purchase orders</span>
                            <TextInput aria-label="Search purchase orders" type="search" placeholder="Search number or supplier" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
                        </label>
                        <SelectInput aria-label="Filter purchase orders by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                            <option value="">All statuses</option>
                            {statuses.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
                        </SelectInput>
                        <SelectInput aria-label="Filter purchase orders by supplier" value={supplierId} onChange={(event) => { setSupplierId(event.target.value); setPage(1); }}>
                            <option value="">All suppliers</option>
                            {supplierQuery.data?.data.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                        </SelectInput>
                        <label className="inventory-date-filter"><span>Order from</span><TextInput aria-label="Orders from date" type="date" value={orderFrom} onChange={(event) => { setOrderFrom(event.target.value); setPage(1); }} /></label>
                        <label className="inventory-date-filter"><span>Order to</span><TextInput aria-label="Orders through date" type="date" value={orderTo} onChange={(event) => { setOrderTo(event.target.value); setPage(1); }} /></label>
                        <label className="inventory-date-filter"><span>Expected from</span><TextInput aria-label="Expected delivery from date" type="date" value={expectedFrom} onChange={(event) => { setExpectedFrom(event.target.value); setPage(1); }} /></label>
                        <label className="inventory-date-filter"><span>Expected to</span><TextInput aria-label="Expected delivery through date" type="date" value={expectedTo} onChange={(event) => { setExpectedTo(event.target.value); setPage(1); }} /></label>
                        <SelectInput aria-label="Sort purchase orders" value={`${sortBy}:${sortDirection}`} onChange={(event) => {
                            const [field, direction] = event.target.value.split(':') as [NonNullable<PurchaseOrderFilters['sort_by']>, NonNullable<PurchaseOrderFilters['sort_direction']>];
                            setSortBy(field);
                            setSortDirection(direction);
                            setPage(1);
                        }}>
                            <option value="id:desc">Newest first</option>
                            <option value="order_number:asc">Order number</option>
                            <option value="order_date:desc">Order date</option>
                            <option value="expected_delivery_date:asc">Expected delivery</option>
                            <option value="total:desc">Highest total</option>
                            <option value="status:asc">Status</option>
                        </SelectInput>
                    </div>
                </div>
                {ordersQuery.isPending ? (
                    <LoadingState label="Loading purchase orders…" />
                ) : ordersQuery.isError ? (
                    <ErrorState title="Purchase orders could not be loaded" message={getErrorMessage(ordersQuery.error, 'Check your connection and try again.')} action={<Button onClick={() => void ordersQuery.refetch()}>Try again</Button>} />
                ) : orders.length === 0 ? (
                    <EmptyState title={search || status || supplierId ? 'No orders match these filters' : 'No purchase orders yet'} message="Create a purchase order to start tracking a supplier delivery." action={canManage ? <Button onClick={() => navigate('/purchase-orders/new')}>Create purchase order</Button> : undefined} />
                ) : (
                    <>
                        <div className="table-scroll">
                            <table className="product-table">
                                <thead><tr><th>Order</th><th>Supplier</th><th>Order date</th><th>Expected</th><th>Total</th><th>Status</th></tr></thead>
                                <tbody>{orders.map((order) => (
                                    <tr key={order.id}>
                                        <td><Link to={`/purchase-orders/${order.id}`}>{order.order_number}</Link></td>
                                        <td>{order.supplier?.name ?? 'Supplier unavailable'}</td>
                                        <td>{order.order_date}</td>
                                        <td>{order.expected_delivery_date ?? '—'}</td>
                                        <td>{Number(order.total).toFixed(2)}</td>
                                        <td><span className={`purchase-status purchase-status--${order.status}`}>{order.status.replaceAll('_', ' ')}</span></td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                        <nav className="pagination" aria-label="Purchase order pages">
                            <span className="pagination__summary">{ordersQuery.data?.total ?? 0} orders · Page {page} of {ordersQuery.data?.last_page ?? 1}</span>
                            <div className="pagination__controls">
                                <Button size="small" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
                                <Button size="small" variant="secondary" disabled={page >= (ordersQuery.data?.last_page ?? 1)} onClick={() => setPage((value) => value + 1)}>Next</Button>
                            </div>
                        </nav>
                    </>
                )}
            </Card>
        </>
    );
}
