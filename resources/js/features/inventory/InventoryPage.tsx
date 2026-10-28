import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { Button, Card, EmptyState, ErrorState, Icon, LoadingState, PageHeader, SelectInput, TextInput } from '../../components/ui';
import { getCategories } from '../products/api';
import type { Category } from '../products/types';
import { getInventory } from './api';
import type { InventoryFilters, InventoryProduct } from './types';

function StockStatus({ product }: { product: InventoryProduct }) {
    if (product.quantity_on_hand <= 0) {
        return <span className="inventory-status inventory-status--out">Out of stock</span>;
    }
    if (product.quantity_on_hand <= product.reorder_level) {
        return <span className="inventory-status inventory-status--low">Low stock</span>;
    }
    return <span className="inventory-status inventory-status--healthy">In stock</span>;
}

export function InventoryPage() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [status, setStatus] = useState<InventoryFilters['status']>('all');
    const [sort, setSort] = useState('name:asc');
    const [page, setPage] = useState(1);
    const [sortBy, sortDirection] = sort.split(':') as [InventoryFilters['sort_by'], InventoryFilters['sort_direction']];

    const filters = useMemo<InventoryFilters>(() => ({
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(categoryId ? { category_id: Number(categoryId) } : {}),
        status,
        sort_by: sortBy,
        sort_direction: sortDirection,
        page,
        per_page: 15,
    }), [search, categoryId, status, sortBy, sortDirection, page]);

    const inventoryQuery = useQuery({
        queryKey: ['inventory', filters],
        queryFn: () => getInventory(filters),
    });
    const categoriesQuery = useQuery({
        queryKey: ['categories', { per_page: 100 }],
        queryFn: getCategories,
    });
    const products = inventoryQuery.data?.data ?? [];
    const filtered = Boolean(search.trim() || categoryId || status !== 'all');

    function clearFilters() {
        setSearch('');
        setCategoryId('');
        setStatus('all');
        setPage(1);
    }

    return (
        <>
            <PageHeader
                title="Inventory"
                description="Monitor available stock, reorder thresholds, and movement history."
                eyebrow="STOCK CONTROL"
                actions={
                    <Button onClick={() => navigate('/inventory/operations')}>
                        <Icon name="plus" size={17} />
                        Record movement
                    </Button>
                }
            />

            <div className="inventory-stats" aria-label="Inventory summary">
                <Card className="inventory-stat">
                    <span>Active products</span>
                    <strong>{inventoryQuery.data?.active_products_count ?? '—'}</strong>
                    <small>Products tracked in stock</small>
                </Card>
                <Card className="inventory-stat inventory-stat--warning">
                    <span>Low-stock products</span>
                    <strong>{inventoryQuery.data?.low_stock_count ?? '—'}</strong>
                    <small>At or below their reorder level</small>
                </Card>
            </div>

            <Card className="inventory-card">
                <div className="list-toolbar">
                    <div className="list-toolbar__heading">
                        <h2>Stock overview</h2>
                        <span>{inventoryQuery.data?.total ?? '—'} matching products</span>
                    </div>
                    <div className="filter-bar" role="search">
                        <label className="search-field">
                            <Icon name="search" size={17} />
                            <span className="sr-only">Search inventory by name or SKU</span>
                            <TextInput
                                aria-label="Search inventory by name or SKU"
                                onChange={(event) => {
                                    setSearch(event.target.value);
                                    setPage(1);
                                }}
                                placeholder="Search name or SKU"
                                type="search"
                                value={search}
                            />
                        </label>
                        <SelectInput
                            aria-label="Filter inventory by category"
                            disabled={categoriesQuery.isPending || categoriesQuery.isError}
                            onChange={(event) => {
                                setCategoryId(event.target.value);
                                setPage(1);
                            }}
                            value={categoryId}
                        >
                            <option value="">All categories</option>
                            {categoriesQuery.data?.data.map((category: Category) => (
                                <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                        </SelectInput>
                        <SelectInput
                            aria-label="Filter inventory by stock status"
                            onChange={(event) => {
                                setStatus(event.target.value as InventoryFilters['status']);
                                setPage(1);
                            }}
                            value={status}
                        >
                            <option value="all">All stock</option>
                            <option value="in_stock">In stock</option>
                            <option value="low_stock">Low stock</option>
                            <option value="out_of_stock">Out of stock</option>
                        </SelectInput>
                        <SelectInput
                            aria-label="Sort inventory"
                            onChange={(event) => {
                                setSort(event.target.value);
                                setPage(1);
                            }}
                            value={sort}
                        >
                            <option value="name:asc">Name A–Z</option>
                            <option value="name:desc">Name Z–A</option>
                            <option value="sku:asc">SKU A–Z</option>
                            <option value="quantity_on_hand:asc">Lowest quantity</option>
                            <option value="quantity_on_hand:desc">Highest quantity</option>
                            <option value="reorder_level:asc">Lowest reorder level</option>
                        </SelectInput>
                    </div>
                </div>

                {inventoryQuery.isPending ? (
                    <LoadingState label="Loading inventory…" />
                ) : inventoryQuery.isError ? (
                    <ErrorState
                        title="Inventory could not be loaded"
                        message={getErrorMessage(inventoryQuery.error, 'Check your connection and try again.')}
                        action={<Button onClick={() => void inventoryQuery.refetch()}>Try again</Button>}
                    />
                ) : products.length === 0 ? (
                    <EmptyState
                        title={filtered ? 'No inventory matches these filters' : 'No active products to track'}
                        message={filtered ? 'Try changing your search or clearing the filters.' : 'Active products will appear here with their current stock.'}
                        action={filtered ? <Button variant="secondary" onClick={clearFilters}>Clear filters</Button> : undefined}
                    />
                ) : (
                    <>
                        <div className="table-scroll">
                            <table className="product-table inventory-table">
                                <thead>
                                    <tr>
                                        <th scope="col">Product</th>
                                        <th scope="col">Category</th>
                                        <th scope="col">Current quantity</th>
                                        <th scope="col">Reorder level</th>
                                        <th scope="col">Stock status</th>
                                        <th scope="col"><span className="sr-only">History</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map((product) => (
                                        <tr key={product.id}>
                                            <td>
                                                <div className="product-identity">
                                                    <span className="product-avatar" aria-hidden="true">{product.name.slice(0, 1).toUpperCase()}</span>
                                                    <span><strong>{product.name}</strong><small>{product.sku}</small></span>
                                                </div>
                                            </td>
                                            <td>{product.category?.name ?? 'Uncategorized'}</td>
                                            <td className={product.quantity_on_hand <= product.reorder_level ? 'inventory-quantity inventory-quantity--low' : 'inventory-quantity'}>
                                                {new Intl.NumberFormat().format(product.quantity_on_hand)} <small>{product.unit}</small>
                                            </td>
                                            <td>{new Intl.NumberFormat().format(product.reorder_level)} <small>{product.unit}</small></td>
                                            <td><StockStatus product={product} /></td>
                                            <td>
                                                <Link className="inventory-history-link" to={`/inventory/movements?product_id=${product.id}`}>
                                                    View history
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="inventory-cards">
                            {products.map((product) => (
                                <article className="inventory-product-card" key={product.id}>
                                    <div className="inventory-product-card__top">
                                        <div className="product-identity">
                                            <span className="product-avatar" aria-hidden="true">{product.name.slice(0, 1).toUpperCase()}</span>
                                            <span><strong>{product.name}</strong><small>{product.sku}</small></span>
                                        </div>
                                        <StockStatus product={product} />
                                    </div>
                                    <div className="inventory-product-card__quantities">
                                        <span>Available <strong>{product.quantity_on_hand} {product.unit}</strong></span>
                                        <span>Reorder at <strong>{product.reorder_level} {product.unit}</strong></span>
                                    </div>
                                    <Link className="inventory-history-link" to={`/inventory/movements?product_id=${product.id}`}>View stock history</Link>
                                </article>
                            ))}
                        </div>
                        <nav className="pagination" aria-label="Inventory pages">
                            <span className="pagination__summary">
                                {inventoryQuery.data?.total ?? 0} products · Page {inventoryQuery.data?.current_page ?? 1} of {inventoryQuery.data?.last_page ?? 1}
                            </span>
                            <div className="pagination__controls">
                                <Button size="small" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)} aria-label="Previous inventory page">
                                    Previous
                                </Button>
                                <Button size="small" variant="secondary" disabled={page >= (inventoryQuery.data?.last_page ?? 1)} onClick={() => setPage((value) => value + 1)} aria-label="Next inventory page">
                                    Next
                                </Button>
                            </div>
                        </nav>
                    </>
                )}
            </Card>
        </>
    );
}
