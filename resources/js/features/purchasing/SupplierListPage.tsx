import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { Button, Card, EmptyState, ErrorState, Icon, LoadingState, PageHeader, SelectInput, TextInput } from '../../components/ui';
import { deactivateSupplier, getSuppliers } from './api';
import { useAuth } from '../../auth/AuthProvider';
import type { SupplierFilters } from './types';

export function SupplierListPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const canManage = Boolean(user?.permissions.includes('suppliers.manage'));
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [page, setPage] = useState(1);
    const [actionError, setActionError] = useState<string | null>(null);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, 250);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    const filters = useMemo<SupplierFilters>(() => ({
        ...(search ? { search } : {}),
        ...(status ? { status: status as 'active' | 'inactive' } : {}),
        sort_by: 'name',
        sort_direction: 'asc',
        page,
        per_page: 15,
    }), [search, status, page]);

    const suppliersQuery = useQuery({
        queryKey: ['suppliers', filters],
        queryFn: () => getSuppliers(filters),
    });
    const deactivateMutation = useMutation({
        mutationFn: deactivateSupplier,
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            setActionError(null);
        },
        onError: (error: unknown) => setActionError(getErrorMessage(error, 'The supplier could not be deactivated.')),
    });

    const suppliers = suppliersQuery.data?.data ?? [];

    return (
        <>
            <PageHeader
                title="Suppliers"
                description="Manage supplier contacts and review purchasing history."
                eyebrow="PURCHASING"
                actions={canManage ? (
                    <Button onClick={() => navigate('/suppliers/new')}>
                        <Icon name="plus" size={17} /> Add supplier
                    </Button>
                ) : undefined}
            />
            {actionError && <div className="notice notice--error" role="alert">{actionError}</div>}
            <Card className="product-list-card purchasing-list-card">
                <div className="list-toolbar">
                    <div className="list-toolbar__heading">
                        <h2>Supplier directory</h2>
                        <span>{suppliersQuery.data?.total ?? '—'} suppliers</span>
                    </div>
                    <div className="filter-bar" role="search">
                        <label className="search-field">
                            <Icon name="search" size={17} />
                            <span className="sr-only">Search suppliers</span>
                            <TextInput
                                aria-label="Search suppliers"
                                placeholder="Search name, code, contact"
                                type="search"
                                value={searchInput}
                                onChange={(event) => setSearchInput(event.target.value)}
                            />
                        </label>
                        <SelectInput
                            aria-label="Filter suppliers by status"
                            value={status}
                            onChange={(event) => {
                                setStatus(event.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="">All statuses</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </SelectInput>
                    </div>
                </div>
                {suppliersQuery.isPending ? (
                    <LoadingState label="Loading suppliers…" />
                ) : suppliersQuery.isError ? (
                    <ErrorState
                        title="Suppliers could not be loaded"
                        message={getErrorMessage(suppliersQuery.error, 'Check your connection and try again.')}
                        action={<Button onClick={() => void suppliersQuery.refetch()}>Try again</Button>}
                    />
                ) : suppliers.length === 0 ? (
                    <EmptyState
                        title={search || status ? 'No suppliers match these filters' : 'No suppliers yet'}
                        message="Create a supplier record to start tracking purchases."
                        action={canManage ? <Button onClick={() => navigate('/suppliers/new')}>Add supplier</Button> : undefined}
                    />
                ) : (
                    <>
                        <div className="table-scroll">
                            <table className="product-table">
                                <thead>
                                    <tr>
                                        <th>Supplier</th><th>Contact</th><th>Phone</th><th>Purchase orders</th><th>Status</th><th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suppliers.map((supplier) => (
                                        <tr key={supplier.id}>
                                            <td><strong>{supplier.name}</strong><small>{supplier.supplier_code}</small></td>
                                            <td>{supplier.contact_person || supplier.email || '—'}</td>
                                            <td>{supplier.phone || '—'}</td>
                                            <td>{supplier.purchase_orders_count ?? 0}</td>
                                            <td><span className={`status-badge ${supplier.is_active ? 'status-badge--success' : 'status-badge--neutral'}`}>{supplier.is_active ? 'Active' : 'Inactive'}</span></td>
                                            <td className="table-actions">
                                                <Link to={`/suppliers/${supplier.id}`}>View</Link>
                                                {canManage && supplier.is_active && (
                                                    <Button
                                                        size="small"
                                                        variant="quiet"
                                                        disabled={deactivateMutation.isPending}
                                                        onClick={() => {
                                                            if (window.confirm(`Deactivate ${supplier.name}? Existing purchase history will be retained.`)) {
                                                                deactivateMutation.mutate(supplier.id);
                                                            }
                                                        }}
                                                    >
                                                        Deactivate
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <nav className="pagination" aria-label="Supplier pages">
                            <span className="pagination__summary">{suppliersQuery.data?.total ?? 0} suppliers · Page {page} of {suppliersQuery.data?.last_page ?? 1}</span>
                            <div className="pagination__controls">
                                <Button size="small" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
                                <Button size="small" variant="secondary" disabled={page >= (suppliersQuery.data?.last_page ?? 1)} onClick={() => setPage((value) => value + 1)}>Next</Button>
                            </div>
                        </nav>
                    </>
                )}
            </Card>
        </>
    );
}
