import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Icon, LoadingState, PageHeader, Pagination, SelectInput, StatusBadge, TextInput } from '../../components/ui';
import { archiveProduct, getCategories, getProducts } from './api';
import type { Product, ProductFilters } from './types';

const currencyFormat = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function formatMoney(value: string): string {
    const amount = Number(value);
    return Number.isFinite(amount) ? currencyFormat.format(amount) : '—';
}

function formatQuantity(value?: number | null): string {
    return value === null || value === undefined ? '—' : new Intl.NumberFormat().format(value);
}

export function ProductListPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [status, setStatus] = useState('');
    const [sortBy, setSortBy] = useState<ProductFilters['sort_by']>('name');
    const [sortDirection, setSortDirection] = useState<ProductFilters['sort_direction']>('asc');
    const [page, setPage] = useState(1);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    useEffect(() => {
        const state = location.state as { notice?: string } | null;
        if (state?.notice) {
            setNotice(state.notice);
            navigate(location.pathname, { replace: true, state: null });
        }
    }, [location.pathname, location.state, navigate]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, 250);
        return () => window.clearTimeout(timeout);
    }, [searchInput]);

    const filters = useMemo<ProductFilters>(() => ({
        ...(search ? { search } : {}),
        ...(categoryId ? { category_id: Number(categoryId) } : {}),
        ...(status ? { is_active: status === 'active' ? 1 : 0 } : {}),
        sort_by: sortBy,
        sort_direction: sortDirection,
        page,
        per_page: 15,
    }), [search, categoryId, status, sortBy, sortDirection, page]);

    const productsQuery = useQuery({
        queryKey: ['products', filters],
        queryFn: () => getProducts(filters),
    });
    const categoriesQuery = useQuery({
        queryKey: ['categories', { per_page: 100 }],
        queryFn: getCategories,
    });
    const archiveMutation = useMutation({
        mutationFn: (product: Product) => archiveProduct(product.id),
        onSuccess: async (_archivedProduct, product) => {
            setNotice(`${product.name} was archived.`);
            setSelectedProduct(null);
            setPage(1);
            await queryClient.invalidateQueries({ queryKey: ['products'] });
            await queryClient.invalidateQueries({ queryKey: ['product'] });
        },
        onError: (error: unknown) => {
            setActionError(getErrorMessage(error, 'The product could not be archived. Please try again.'));
        },
    });

    function clearFilters() {
        setSearchInput('');
        setSearch('');
        setCategoryId('');
        setStatus('');
        setPage(1);
    }

    function changeSort(value: string) {
        const [nextSort, nextDirection] = value.split(':') as [ProductFilters['sort_by'], ProductFilters['sort_direction']];
        setSortBy(nextSort);
        setSortDirection(nextDirection);
        setPage(1);
    }

    const products = productsQuery.data?.data ?? [];
    const filtered = Boolean(search || categoryId || status);

    return (
        <>
            <PageHeader
                title="Products"
                description="Manage your catalog, pricing, and reorder thresholds."
                eyebrow="CATALOG"
                actions={
                    <Button onClick={() => navigate('/products/new')}>
                        <Icon name="plus" size={17} />
                        Add product
                    </Button>
                }
            />

            {notice && (
                <div className="notice notice--success" role="status">
                    <span aria-hidden="true">✓</span>
                    {notice}
                    <button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}>×</button>
                </div>
            )}
            {actionError && (
                <div className="notice notice--error" role="alert">
                    {actionError}
                    <button type="button" aria-label="Dismiss error" onClick={() => setActionError(null)}>×</button>
                </div>
            )}

            <Card className="product-list-card">
                <div className="list-toolbar">
                    <div className="list-toolbar__heading">
                        <h2>Product catalog</h2>
                        <span>{productsQuery.data?.total ?? '—'} total</span>
                    </div>
                    <div className="filter-bar" role="search">
                        <label className="search-field">
                            <Icon name="search" size={17} />
                            <span className="sr-only">Search products by name or SKU</span>
                            <TextInput
                                aria-label="Search products by name or SKU"
                                onChange={(event) => setSearchInput(event.target.value)}
                                placeholder="Search name or SKU"
                                type="search"
                                value={searchInput}
                            />
                        </label>
                        <SelectInput
                            aria-label="Filter by category"
                            disabled={categoriesQuery.isPending || categoriesQuery.isError}
                            onChange={(event) => {
                                setCategoryId(event.target.value);
                                setPage(1);
                            }}
                            value={categoryId}
                        >
                            <option value="">All categories</option>
                            {categoriesQuery.data?.data.map((category) => (
                                <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                        </SelectInput>
                        <SelectInput
                            aria-label="Filter by status"
                            onChange={(event) => {
                                setStatus(event.target.value);
                                setPage(1);
                            }}
                            value={status}
                        >
                            <option value="">All statuses</option>
                            <option value="active">Active</option>
                            <option value="archived">Archived</option>
                        </SelectInput>
                        <SelectInput
                            aria-label="Sort products"
                            onChange={(event) => changeSort(event.target.value)}
                            value={`${sortBy}:${sortDirection}`}
                        >
                            <option value="name:asc">Name A–Z</option>
                            <option value="name:desc">Name Z–A</option>
                            <option value="sku:asc">SKU A–Z</option>
                            <option value="sku:desc">SKU Z–A</option>
                            <option value="selling_price:asc">Price low to high</option>
                            <option value="selling_price:desc">Price high to low</option>
                        </SelectInput>
                    </div>
                </div>

                {productsQuery.isPending ? (
                    <LoadingState label="Loading products…" />
                ) : productsQuery.isError ? (
                    <ErrorState
                        title="Products could not be loaded"
                        message={getErrorMessage(productsQuery.error, 'Check your connection and try again.')}
                        action={<Button onClick={() => void productsQuery.refetch()}>Try again</Button>}
                    />
                ) : products.length === 0 ? (
                    <EmptyState
                        title={filtered ? 'No products match these filters' : 'Your catalog is ready to begin'}
                        message={filtered
                            ? 'Try changing your search or clearing the filters.'
                            : 'Add your first product to start organizing your inventory.'}
                        action={filtered
                            ? <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>
                            : <Button onClick={() => navigate('/products/new')}><Icon name="plus" size={17} /> Add product</Button>}
                    />
                ) : (
                    <>
                        <div className="table-scroll">
                            <table className="product-table">
                                <thead>
                                    <tr>
                                        <th scope="col">Product</th>
                                        <th scope="col">Category</th>
                                        <th scope="col">Cost price</th>
                                        <th scope="col">Selling price</th>
                                        <th scope="col">Stock on hand</th>
                                        <th scope="col">Status</th>
                                        <th scope="col"><span className="sr-only">Actions</span></th>
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
                                            <td>{formatMoney(product.cost_price)}</td>
                                            <td>{formatMoney(product.selling_price)}</td>
                                            <td>
                                                <span className={product.stock_balance && product.stock_balance.quantity_on_hand <= product.reorder_level ? 'stock-value stock-value--low' : 'stock-value'}>
                                                    {formatQuantity(product.stock_balance?.quantity_on_hand)} <small>{product.unit}</small>
                                                </span>
                                                {product.stock_balance && product.stock_balance.quantity_on_hand <= product.reorder_level && (
                                                    <span className="stock-low-label">Low stock</span>
                                                )}
                                            </td>
                                            <td><StatusBadge active={product.is_active} /></td>
                                            <td>
                                                <div className="row-actions">
                                                    <Button
                                                        aria-label={`Edit ${product.name}`}
                                                        size="small"
                                                        variant="quiet"
                                                        onClick={() => navigate(`/products/${product.id}/edit`)}
                                                    >
                                                        <Icon name="edit" size={16} />
                                                    </Button>
                                                    {product.is_active && (
                                                        <Button
                                                            aria-label={`Archive ${product.name}`}
                                                            size="small"
                                                            variant="quiet"
                                                            onClick={() => {
                                                                setActionError(null);
                                                                setSelectedProduct(product);
                                                            }}
                                                        >
                                                            <Icon name="archive" size={16} />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="product-cards">
                            {products.map((product) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    onArchive={() => {
                                        setActionError(null);
                                        setSelectedProduct(product);
                                    }}
                                    onEdit={() => navigate(`/products/${product.id}/edit`)}
                                />
                            ))}
                        </div>
                        <Pagination
                            page={productsQuery.data?.current_page ?? 1}
                            lastPage={productsQuery.data?.last_page ?? 1}
                            total={productsQuery.data?.total ?? 0}
                            onPageChange={setPage}
                        />
                    </>
                )}
            </Card>

            <ConfirmDialog
                confirmLabel="Archive product"
                isOpen={selectedProduct !== null}
                isPending={archiveMutation.isPending}
                message={`“${selectedProduct?.name ?? 'This product'}” will be marked inactive. It will remain in the catalog and can still be viewed.`}
                onCancel={() => setSelectedProduct(null)}
                onConfirm={() => {
                    if (selectedProduct) archiveMutation.mutate(selectedProduct);
                }}
                title="Archive this product?"
            />
        </>
    );
}

function ProductCard({
    product,
    onArchive,
    onEdit,
}: {
    product: Product;
    onArchive: () => void;
    onEdit: () => void;
}) {
    const lowStock = product.stock_balance !== null
        && product.stock_balance !== undefined
        && product.stock_balance.quantity_on_hand <= product.reorder_level;

    return (
        <article className="mobile-product-card">
            <div className="mobile-product-card__top">
                <div className="product-identity">
                    <span className="product-avatar" aria-hidden="true">{product.name.slice(0, 1).toUpperCase()}</span>
                    <span><strong>{product.name}</strong><small>{product.sku}</small></span>
                </div>
                <StatusBadge active={product.is_active} />
            </div>
            <dl className="mobile-product-card__details">
                <div><dt>Category</dt><dd>{product.category?.name ?? 'Uncategorized'}</dd></div>
                <div><dt>Selling price</dt><dd>{formatMoney(product.selling_price)}</dd></div>
                <div>
                    <dt>Stock on hand</dt>
                    <dd className={lowStock ? 'stock-value--low' : ''}>
                        {formatQuantity(product.stock_balance?.quantity_on_hand)} {product.unit}
                        {lowStock && <span className="stock-low-label">Low stock</span>}
                    </dd>
                </div>
            </dl>
            <div className="mobile-product-card__actions">
                <Button size="small" variant="secondary" onClick={onEdit}><Icon name="edit" size={15} /> Edit</Button>
                {product.is_active && <Button size="small" variant="quiet" onClick={onArchive}><Icon name="archive" size={15} /> Archive</Button>}
            </div>
        </article>
    );
}
