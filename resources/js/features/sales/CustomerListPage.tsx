import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { Button, Card, EmptyState, ErrorState, Icon, LoadingState, PageHeader, Pagination, SelectInput, TextInput } from '../../components/ui';
import { useAuth } from '../../auth/AuthProvider';
import { deleteCustomer, getCustomers } from './api';
import type { CustomerFilters } from './types';

const money = (value?: string | null) => Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CustomerListPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const canManage = Boolean(user?.permissions.includes('customers.manage'));
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [sortBy, setSortBy] = useState<CustomerFilters['sort_by']>('name');
    const [sortDirection, setSortDirection] = useState<CustomerFilters['sort_direction']>('asc');
    const [page, setPage] = useState(1);
    const [actionError, setActionError] = useState<string | null>(null);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, 250);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    const filters = useMemo<CustomerFilters>(() => ({
        ...(search ? { search } : {}),
        ...(status ? { status: status as 'active' | 'inactive' } : {}),
        sort_by: sortBy,
        sort_direction: sortDirection,
        page,
        per_page: 15,
    }), [search, status, sortBy, sortDirection, page]);
    const customersQuery = useQuery({ queryKey: ['customers', filters], queryFn: () => getCustomers(filters) });
    const deleteMutation = useMutation({
        mutationFn: deleteCustomer,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['customers'] });
            setActionError(null);
        },
        onError: (error: unknown) => setActionError(getErrorMessage(error, 'The customer could not be deleted.')),
    });
    const customers = customersQuery.data?.data ?? [];

    return (
        <>
            <PageHeader
                title="Customers"
                description="Manage customer contacts and review sales history."
                eyebrow="SALES"
                actions={canManage ? <Button onClick={() => navigate('/customers/new')}><Icon name="plus" size={17} /> Add customer</Button> : undefined}
            />
            {actionError && <div className="notice notice--error" role="alert">{actionError}</div>}
            <Card className="product-list-card">
                <div className="list-toolbar">
                    <div className="list-toolbar__heading"><h2>Customer directory</h2><span>{customersQuery.data?.total ?? '—'} customers</span></div>
                    <div className="filter-bar" role="search">
                        <label className="search-field">
                            <Icon name="search" size={17} />
                            <span className="sr-only">Search customers</span>
                            <TextInput aria-label="Search customers" placeholder="Search name, code, company, email, phone" type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
                        </label>
                        <SelectInput aria-label="Filter customers by status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                            <option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
                        </SelectInput>
                        <SelectInput aria-label="Sort customers" value={`${sortBy}:${sortDirection}`} onChange={(event) => {
                            const [field, direction] = event.target.value.split(':') as [CustomerFilters['sort_by'], CustomerFilters['sort_direction']];
                            setSortBy(field); setSortDirection(direction); setPage(1);
                        }}>
                            <option value="name:asc">Name A–Z</option><option value="name:desc">Name Z–A</option>
                            <option value="customer_code:asc">Code A–Z</option><option value="created_at:desc">Newest</option>
                        </SelectInput>
                    </div>
                </div>
                {customersQuery.isPending ? <LoadingState label="Loading customers…" /> : customersQuery.isError ? (
                    <ErrorState title="Customers could not be loaded" message={getErrorMessage(customersQuery.error, 'Check your connection and try again.')} action={<Button onClick={() => void customersQuery.refetch()}>Try again</Button>} />
                ) : customers.length === 0 ? (
                    <EmptyState title={search || status ? 'No customers match these filters' : 'No customers yet'} message="Create a customer record to start tracking sales." action={canManage ? <Button onClick={() => navigate('/customers/new')}>Add customer</Button> : undefined} />
                ) : (
                    <>
                        <div className="table-scroll sales-table-scroll"><table className="product-table">
                            <thead><tr><th>Customer</th><th>Contact</th><th>Orders</th><th>Order value</th><th>Outstanding</th><th>Status</th><th>Actions</th></tr></thead>
                            <tbody>{customers.map((customer) => (
                                <tr key={customer.id}>
                                    <td><strong>{customer.name}</strong><small>{customer.customer_code}{customer.company_name ? ` · ${customer.company_name}` : ''}</small></td>
                                    <td>{customer.email || customer.phone || '—'}</td>
                                    <td>{customer.orders_count ?? 0}</td>
                                    <td>{money(customer.orders_sum_total)}</td>
                                    <td>{customer.outstanding_orders_count ?? 0}</td>
                                    <td><span className={`status-badge ${customer.status === 'active' ? 'status-badge--success' : 'status-badge--neutral'}`}>{customer.status}</span></td>
                                    <td className="table-actions"><Link to={`/customers/${customer.id}`}>View</Link>{canManage && <Link to={`/customers/${customer.id}/edit`}>Edit</Link>}{canManage && (customer.orders_count ?? 0) === 0 && <Button size="small" variant="quiet" disabled={deleteMutation.isPending} onClick={() => {
                                        if (window.confirm(`Delete ${customer.name}?`)) deleteMutation.mutate(customer.id);
                                    }}>Delete</Button>}</td>
                                </tr>
                            ))}</tbody>
                        </table></div>
                        <Pagination page={customersQuery.data.current_page} lastPage={customersQuery.data.last_page} total={customersQuery.data.total} itemLabel="customer" onPageChange={setPage} />
                    </>
                )}
            </Card>
        </>
    );
}
