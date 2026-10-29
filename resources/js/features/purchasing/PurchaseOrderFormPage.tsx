import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getErrorMessage, getValidationErrors } from '../../api/client';
import { Button, Card, ErrorState, FormField, LoadingState, PageHeader, SelectInput, TextInput } from '../../components/ui';
import { getProducts } from '../products/api';
import { createPurchaseOrder, getPurchaseOrder, getSuppliers, updatePurchaseOrder } from './api';
import type { ProductFilters } from '../products/types';
import type { PurchaseOrderPayload, SupplierFilters } from './types';

type Line = { product_id: string; quantity: string; unit_cost: string };
const blankLine = (): Line => ({ product_id: '', quantity: '1', unit_cost: '' });

export function PurchaseOrderFormPage({ mode }: { mode: 'create' | 'edit' }) {
    const { id } = useParams();
    const orderId = Number(id);
    const invalidId = mode === 'edit' && (!Number.isInteger(orderId) || orderId < 1);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const [supplierId, setSupplierId] = useState(() => mode === 'create' ? searchParams.get('supplier_id') ?? '' : '');
    const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
    const [expectedDate, setExpectedDate] = useState('');
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<Line[]>([blankLine()]);
    const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
    const [formError, setFormError] = useState<string | null>(null);

    const supplierFilters: SupplierFilters = { status: 'active', sort_by: 'name', sort_direction: 'asc', page: 1, per_page: 100 };
    const productFilters: ProductFilters = { is_active: 1, sort_by: 'name', sort_direction: 'asc', page: 1, per_page: 100 };
    const supplierQuery = useQuery({ queryKey: ['suppliers', supplierFilters], queryFn: () => getSuppliers(supplierFilters) });
    const productQuery = useQuery({ queryKey: ['products', productFilters], queryFn: () => getProducts(productFilters) });
    const orderQuery = useQuery({
        queryKey: ['purchase-order', orderId],
        queryFn: () => getPurchaseOrder(orderId),
        enabled: mode === 'edit' && !invalidId,
    });

    useEffect(() => {
        if (orderQuery.data) {
            if (orderQuery.data.status !== 'draft') return;
            setSupplierId(String(orderQuery.data.supplier_id));
            setOrderDate(orderQuery.data.order_date);
            setExpectedDate(orderQuery.data.expected_delivery_date ?? '');
            setNotes(orderQuery.data.notes ?? '');
            setItems(orderQuery.data.items.map((item) => ({
                product_id: String(item.product_id),
                quantity: String(item.quantity),
                unit_cost: item.unit_cost,
            })));
        }
    }, [orderQuery.data]);

    const mutation = useMutation({
        mutationFn: (payload: PurchaseOrderPayload) => mode === 'create'
            ? createPurchaseOrder(payload)
            : updatePurchaseOrder(orderId, payload),
        onSuccess: async (order) => {
            await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
            await queryClient.invalidateQueries({ queryKey: ['purchase-order', order.id] });
            navigate(`/purchase-orders/${order.id}`, { replace: true });
        },
        onError: (error: unknown) => {
            setServerErrors(getValidationErrors(error));
            setFormError(getErrorMessage(error, 'The purchase order could not be saved.'));
        },
    });

    function selectProduct(index: number, productId: string) {
        const product = productQuery.data?.data.find((item) => String(item.id) === productId);
        setItems((current) => current.map((line, lineIndex) => lineIndex === index
            ? { ...line, product_id: productId, unit_cost: product?.cost_price ?? line.unit_cost }
            : line));
    }

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setServerErrors({});
        setFormError(null);
        mutation.mutate({
            supplier_id: Number(supplierId),
            order_date: orderDate,
            expected_delivery_date: expectedDate || null,
            notes: notes.trim(),
            items: items.map((item) => ({
                product_id: Number(item.product_id),
                quantity: Number(item.quantity),
                unit_cost: Number(item.unit_cost),
            })),
        });
    }

    if (invalidId) return <ErrorState title="Invalid purchase order" message="The purchase-order identifier is not valid." />;
    if (supplierQuery.isPending || productQuery.isPending || (mode === 'edit' && orderQuery.isPending)) return <LoadingState label="Loading purchasing options…" />;
    if (supplierQuery.isError || productQuery.isError || (mode === 'edit' && orderQuery.isError)) {
        return <ErrorState title="Purchase order form could not be loaded" message="Check supplier and product access, then try again." />;
    }
    if (mode === 'edit' && orderQuery.data && orderQuery.data.status !== 'draft') {
        return <ErrorState title="Order is no longer editable" message="Purchase-order lines cannot be changed after submission or receiving starts." action={<Button onClick={() => navigate(`/purchase-orders/${orderId}`)}>View order</Button>} />;
    }
    const formSuppliers = [...supplierQuery.data.data];
    if (mode === 'edit' && orderQuery.data?.supplier
        && !formSuppliers.some((supplier) => supplier.id === orderQuery.data?.supplier_id)) {
        formSuppliers.unshift(orderQuery.data.supplier);
    }
    if (!formSuppliers.length || !productQuery.data?.data.length) {
        return <ErrorState title="Purchasing options unavailable" message="Add an active supplier and at least one active product before creating a purchase order." />;
    }

    const selectedSupplierId = formSuppliers.some((supplier) => String(supplier.id) === supplierId) ? supplierId : '';
    const total = items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_cost) || 0), 0);
    const errorAt = (name: string) => serverErrors[name]?.[0];

    return (
        <>
            <nav className="breadcrumbs" aria-label="Breadcrumb"><button type="button" onClick={() => navigate('/purchase-orders')}>Purchase orders</button><span aria-hidden="true">/</span><span>{mode === 'create' ? 'Create order' : 'Edit draft'}</span></nav>
            <PageHeader title={mode === 'create' ? 'Create purchase order' : 'Edit purchase order'} description="Add products and costs. The server calculates the saved totals." />
            <Card className="form-card">
                <form className="product-form" onSubmit={submit} noValidate>
                    {formError && <div className="form-alert" role="alert">{formError}</div>}
                    <div className="form-grid">
                        <FormField htmlFor="po-supplier" label="Supplier" error={errorAt('supplier_id')}>
                            <SelectInput id="po-supplier" required value={selectedSupplierId} hasError={Boolean(errorAt('supplier_id'))} onChange={(event) => setSupplierId(event.target.value)}>
                                <option value="">Choose supplier</option>
                                {formSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name} · {supplier.supplier_code}{supplier.is_active ? '' : ' (Inactive)'}</option>)}
                            </SelectInput>
                        </FormField>
                        <FormField htmlFor="po-order-date" label="Order date" error={errorAt('order_date')}>
                            <TextInput id="po-order-date" required type="date" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} />
                        </FormField>
                        <FormField htmlFor="po-expected-date" label="Expected delivery date" error={errorAt('expected_delivery_date')}>
                            <TextInput id="po-expected-date" type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} />
                        </FormField>
                    </div>
                    <div className="purchase-lines">
                        <div className="list-toolbar__heading"><h2>Products</h2><span>Choose an active product, quantity, and unit cost.</span></div>
                        {items.map((item, index) => (
                            <div className="purchase-line" key={index}>
                                <FormField htmlFor={`po-product-${index}`} label="Product" error={errorAt(`items.${index}.product_id`)}>
                                    <SelectInput id={`po-product-${index}`} required value={item.product_id} onChange={(event) => selectProduct(index, event.target.value)}>
                                        <option value="">Choose product</option>
                                        {productQuery.data.data.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}
                                    </SelectInput>
                                </FormField>
                                <FormField htmlFor={`po-quantity-${index}`} label="Quantity" error={errorAt(`items.${index}.quantity`)}>
                                    <TextInput id={`po-quantity-${index}`} type="number" min="1" step="1" value={item.quantity} onChange={(event) => setItems((current) => current.map((line, row) => row === index ? { ...line, quantity: event.target.value } : line))} />
                                </FormField>
                                <FormField htmlFor={`po-cost-${index}`} label="Unit cost" error={errorAt(`items.${index}.unit_cost`)}>
                                    <TextInput id={`po-cost-${index}`} type="number" min="0.01" step="0.01" value={item.unit_cost} onChange={(event) => setItems((current) => current.map((line, row) => row === index ? { ...line, unit_cost: event.target.value } : line))} />
                                </FormField>
                                <Button type="button" variant="quiet" disabled={items.length === 1} aria-label={`Remove product line ${index + 1}`} onClick={() => setItems((current) => current.filter((_, row) => row !== index))}>Remove</Button>
                            </div>
                        ))}
                        {errorAt('items') && <p className="form-error" role="alert">{errorAt('items')}</p>}
                        <Button type="button" variant="secondary" onClick={() => setItems((current) => [...current, blankLine()])}>Add product</Button>
                    </div>
                    <FormField htmlFor="po-notes" label="Notes" error={errorAt('notes')}>
                        <textarea id="po-notes" className="form-control" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
                    </FormField>
                    <p className="purchase-total">Estimated total <strong>{new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(total)}</strong></p>
                    <div className="form-actions">
                        <Button type="button" variant="secondary" onClick={() => navigate('/purchase-orders')}>Cancel</Button>
                        <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save draft'}</Button>
                    </div>
                </form>
            </Card>
        </>
    );
}
