import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, SelectInput, TextInput } from '../../components/ui';
import { getInventory, getMovements } from './api';
import type { InventoryFilters, MovementFilters, MovementType } from './types';

const movementLabels: Record<MovementType, string> = {
    inbound: 'Received',
    outbound: 'Issued',
    adjustment: 'Adjustment',
};

function formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function formatMovementQuantity(quantity: number, unit: string): string {
    const sign = quantity > 0 ? '+' : '−';
    return `${sign}${new Intl.NumberFormat().format(Math.abs(quantity))} ${unit}`;
}

export function MovementHistoryPage() {
    const [searchParams] = useSearchParams();
    const [productId, setProductId] = useState(searchParams.get('product_id') ?? '');
    const [movementType, setMovementType] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [page, setPage] = useState(1);

    const filters = useMemo<MovementFilters>(() => ({
        ...(productId ? { product_id: Number(productId) } : {}),
        ...(movementType ? { movement_type: movementType as MovementType } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        page,
        per_page: 15,
    }), [productId, movementType, from, to, page]);

    const movementsQuery = useQuery({
        queryKey: ['inventory-movements', filters],
        queryFn: () => getMovements(filters),
    });
    const productsQuery = useQuery({
        queryKey: ['inventory', 'movement-product-options'],
        queryFn: () => getInventory({
            status: 'all',
            sort_by: 'name',
            sort_direction: 'asc',
            page: 1,
            per_page: 100,
        } satisfies InventoryFilters),
    });
    const movements = movementsQuery.data?.data ?? [];
    const filtered = Boolean(productId || movementType || from || to);

    function clearFilters() {
        setProductId('');
        setMovementType('');
        setFrom('');
        setTo('');
        setPage(1);
    }

    return (
        <>
            <PageHeader
                title="Stock movement history"
                description="Review when stock changed, how much moved, and who recorded it."
                eyebrow="INVENTORY AUDIT"
                actions={<Link className="button button--secondary" to="/inventory">Back to inventory</Link>}
            />

            <Card className="inventory-card">
                <div className="list-toolbar">
                    <div className="list-toolbar__heading">
                        <h2>Movement log</h2>
                        <span>{movementsQuery.data?.total ?? '—'} records · newest first</span>
                    </div>
                    <div className="filter-bar inventory-history-filters" role="search">
                        <SelectInput
                            aria-label="Filter movements by product"
                            disabled={productsQuery.isPending || productsQuery.isError}
                            onChange={(event) => {
                                setProductId(event.target.value);
                                setPage(1);
                            }}
                            value={productId}
                        >
                            <option value="">All products</option>
                            {productsQuery.data?.data.map((product) => (
                                <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>
                            ))}
                        </SelectInput>
                        <SelectInput
                            aria-label="Filter movements by type"
                            onChange={(event) => {
                                setMovementType(event.target.value);
                                setPage(1);
                            }}
                            value={movementType}
                        >
                            <option value="">All movement types</option>
                            <option value="inbound">Received</option>
                            <option value="outbound">Issued</option>
                            <option value="adjustment">Adjustments</option>
                        </SelectInput>
                        <label className="inventory-date-filter">
                            <span>From</span>
                            <TextInput
                                aria-label="Movements from date"
                                onChange={(event) => {
                                    setFrom(event.target.value);
                                    setPage(1);
                                }}
                                type="date"
                                value={from}
                            />
                        </label>
                        <label className="inventory-date-filter">
                            <span>To</span>
                            <TextInput
                                aria-label="Movements through date"
                                onChange={(event) => {
                                    setTo(event.target.value);
                                    setPage(1);
                                }}
                                type="date"
                                value={to}
                            />
                        </label>
                    </div>
                </div>

                {movementsQuery.isPending ? (
                    <LoadingState label="Loading movement history…" />
                ) : movementsQuery.isError ? (
                    <ErrorState
                        title="Movement history could not be loaded"
                        message={getErrorMessage(movementsQuery.error, 'Check your connection and try again.')}
                        action={<Button onClick={() => void movementsQuery.refetch()}>Try again</Button>}
                    />
                ) : movements.length === 0 ? (
                    <EmptyState
                        title={filtered ? 'No movements match these filters' : 'No stock movements yet'}
                        message={filtered ? 'Try adjusting your filters or clearing them.' : 'Completed receipts, issues, and adjustments will appear here.'}
                        action={filtered ? <Button variant="secondary" onClick={clearFilters}>Clear filters</Button> : undefined}
                    />
                ) : (
                    <>
                        <div className="table-scroll">
                            <table className="product-table movement-table">
                                <thead>
                                    <tr>
                                        <th scope="col">Date</th>
                                        <th scope="col">Product</th>
                                        <th scope="col">Type</th>
                                        <th scope="col">Change</th>
                                        <th scope="col">Before → after</th>
                                        <th scope="col">Reason / reference</th>
                                        <th scope="col">Recorded by</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movements.map((movement) => (
                                        <tr key={movement.id}>
                                            <td>{formatDate(movement.created_at)}</td>
                                            <td>
                                                <span className="movement-product"><strong>{movement.product?.name ?? `Product #${movement.product_id}`}</strong><small>{movement.product?.sku ?? 'Product unavailable'}</small></span>
                                            </td>
                                            <td><span className={`movement-type movement-type--${movement.movement_type}`}>{movementLabels[movement.movement_type]}</span></td>
                                            <td className={movement.quantity_delta < 0 ? 'movement-quantity movement-quantity--negative' : 'movement-quantity movement-quantity--positive'}>
                                                {formatMovementQuantity(movement.quantity_delta, movement.product?.unit ?? 'units')}
                                            </td>
                                            <td>
                                                {movement.quantity_before === null || movement.quantity_after === null
                                                    ? '—'
                                                    : `${movement.quantity_before} → ${movement.quantity_after}`}
                                            </td>
                                            <td>
                                                <span className="movement-reason">{movement.reason || '—'}</span>
                                                {movement.reference_type && (
                                                    <small className="movement-reference">
                                                        {movement.reference_type}{movement.reference_id ? ` #${movement.reference_id}` : ''}
                                                    </small>
                                                )}
                                            </td>
                                            <td>{movement.creator?.name ?? 'Unknown user'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="movement-cards">
                            {movements.map((movement) => (
                                <article className="movement-card" key={movement.id}>
                                    <div className="movement-card__heading">
                                        <strong>{movement.product?.name ?? `Product #${movement.product_id}`}</strong>
                                        <span className={`movement-type movement-type--${movement.movement_type}`}>{movementLabels[movement.movement_type]}</span>
                                    </div>
                                    <small>{formatDate(movement.created_at)} · {movement.creator?.name ?? 'Unknown user'}</small>
                                    <strong className={movement.quantity_delta < 0 ? 'movement-quantity--negative' : 'movement-quantity--positive'}>
                                        {formatMovementQuantity(movement.quantity_delta, movement.product?.unit ?? 'units')}
                                    </strong>
                                    <span>Balance: {movement.quantity_before ?? '—'} → {movement.quantity_after ?? '—'}</span>
                                    <p>{movement.reason || 'No reason provided'}</p>
                                </article>
                            ))}
                        </div>
                        <nav className="pagination" aria-label="Movement history pages">
                            <span className="pagination__summary">
                                {movementsQuery.data?.total ?? 0} movements · Page {movementsQuery.data?.current_page ?? 1} of {movementsQuery.data?.last_page ?? 1}
                            </span>
                            <div className="pagination__controls">
                                <Button size="small" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous movement page">Previous</Button>
                                <Button size="small" variant="secondary" disabled={page >= (movementsQuery.data?.last_page ?? 1)} onClick={() => setPage((value) => value + 1)} aria-label="Next movement page">Next</Button>
                            </div>
                        </nav>
                    </>
                )}
            </Card>
        </>
    );
}
