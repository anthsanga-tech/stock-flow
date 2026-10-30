import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { getErrorMessage, getValidationErrors } from '../../api/client';
import { Button, Card, ErrorState, FormField, LoadingState, PageHeader, SelectInput, TextInput } from '../../components/ui';
import { getCustomers, getSalesOrder, getSalesProducts, createSalesOrder, updateSalesOrder } from './api';
import type { SalesOrderPayload, SalesProduct } from './types';

type LineDraft = { product_id: number; quantity: number; unit_price: number; discount_amount: number };
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): LineDraft => ({ product_id: 0, quantity: 1, unit_price: 0, discount_amount: 0 });
const money = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function SalesOrderFormPage({ mode }: { mode: 'create' | 'edit' }) {
    const { id } = useParams();
    const orderId = Number(id);
    const invalidId = mode === 'edit' && (!Number.isInteger(orderId) || orderId < 1);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [customerId, setCustomerId] = useState('');
    const [customerSearch, setCustomerSearch] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [orderDate, setOrderDate] = useState(today());
    const [expectedDate, setExpectedDate] = useState('');
    const [discount, setDiscount] = useState(0);
    const [tax, setTax] = useState(0);
    const [notes, setNotes] = useState('');
    const [items, setItems] = useState<LineDraft[]>([emptyLine()]);
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const customersQuery = useQuery({
        queryKey: ['customers', 'active-order-options', customerSearch],
        queryFn: () => getCustomers({
            status: 'active',
            ...(customerSearch.trim() ? { search: customerSearch.trim() } : {}),
            sort_by: 'name',
            sort_direction: 'asc',
            page: 1,
            per_page: 100,
        }),
    });
    const productsQuery = useQuery({ queryKey: ['sales-products'], queryFn: () => getSalesProducts() });
    const orderQuery = useQuery({ queryKey: ['sales-order', orderId], queryFn: () => getSalesOrder(orderId), enabled: mode === 'edit' && !invalidId });

    useEffect(() => {
        if (orderQuery.data) {
            const order = orderQuery.data;
            setCustomerId(String(order.customer_id));
            setCustomerSearch(order.customer?.name ?? '');
            setOrderDate(order.order_date);
            setExpectedDate(order.expected_delivery_date ?? '');
            setDiscount(Number(order.discount));
            setTax(Number(order.tax));
            setNotes(order.notes ?? '');
            setItems(order.items.map((item) => ({
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: Number(item.unit_price),
                discount_amount: Number(item.discount_amount),
            })));
        }
    }, [orderQuery.data]);

    const mutation = useMutation({
        mutationFn: (payload: SalesOrderPayload) => mode === 'create' ? createSalesOrder(payload) : updateSalesOrder(orderId, payload),
        onSuccess: async (order) => {
            await queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
            await queryClient.invalidateQueries({ queryKey: ['sales-order', order.id] });
            navigate(`/orders/${order.id}`, { replace: true });
        },
        onError: (error: unknown) => {
            setErrors(getValidationErrors(error));
            setFormError(getErrorMessage(error, 'The sales order could not be saved. Check the fields and try again.'));
        },
    });

    const productMap = useMemo(() => new Map((productsQuery.data ?? []).map((product) => [product.id, product])), [productsQuery.data]);
    const visibleProducts = (productsQuery.data ?? []).filter((product) =>
        `${product.sku} ${product.name}`.toLowerCase().includes(productSearch.trim().toLowerCase())
    );
    const subtotal = items.reduce((sum, item) => sum + Math.max(0, item.quantity * item.unit_price - item.discount_amount), 0);
    const total = Math.max(0, subtotal - discount) + tax;

    function updateItem(index: number, patch: Partial<LineDraft>) {
        setItems((current) => current.map((item, row) => row === index ? { ...item, ...patch } : item));
        setFormError(null);
    }

    function selectProduct(index: number, value: string) {
        const product = productMap.get(Number(value));
        updateItem(index, { product_id: Number(value), unit_price: Number(product?.selling_price ?? 0) });
    }

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrors({});
        setFormError(null);
        mutation.mutate({
            customer_id: Number(customerId),
            order_date: orderDate,
            expected_delivery_date: expectedDate || null,
            discount_amount: Number(discount),
            tax: Number(tax),
            notes: notes.trim() || undefined,
            items: items.map((item) => ({
                product_id: Number(item.product_id),
                quantity: Number(item.quantity),
                unit_price: Number(item.unit_price),
                discount_amount: Number(item.discount_amount),
            })),
        });
    }

    if (invalidId) return <ErrorState title="Invalid sales order" message="The order identifier is not valid." />;
    if (mode === 'edit' && orderQuery.isPending) return <LoadingState label="Loading sales order…" />;
    if (mode === 'edit' && orderQuery.isError) return <ErrorState title="Sales order could not be loaded" message={getErrorMessage(orderQuery.error, 'Try again in a moment.')} />;
    if (mode === 'edit' && orderQuery.data?.status !== 'draft') return <ErrorState title="Order cannot be edited" message="Only draft sales orders can be changed." />;
    if (customersQuery.isError || productsQuery.isError) return <ErrorState title="Order form could not be loaded" message={getErrorMessage(customersQuery.error ?? productsQuery.error, 'Refresh the page and try again.')} />;
    if (customersQuery.isPending || productsQuery.isPending) return <LoadingState label="Loading order options…" />;
    const lineError = (index: number, field: string) => errors[`items.${index}.${field}`]?.[0];

    return (
        <>
            <nav className="breadcrumbs" aria-label="Breadcrumb"><button type="button" onClick={() => navigate('/orders')}>Sales orders</button><span aria-hidden="true">/</span><span>{mode === 'create' ? 'Create order' : 'Edit draft'}</span></nav>
            <PageHeader title={mode === 'create' ? 'Create a sales order' : 'Edit sales order'} description="Prices and totals are validated and recalculated by the server." eyebrow="SALES" />
            <Card className="form-card"><form className="product-form" onSubmit={submit} noValidate>
                {formError && <div className="form-alert" role="alert">{formError}</div>}
                <div className="form-grid">
                    <FormField htmlFor="customer-search" label="Find customer"><TextInput id="customer-search" aria-label="Search customers for order" placeholder="Search customer name, code, email, phone" value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} /></FormField>
                    <FormField htmlFor="order-customer" label="Customer" error={errors.customer_id?.[0]}><SelectInput id="order-customer" required value={customerId} hasError={Boolean(errors.customer_id?.[0])} onChange={(event) => setCustomerId(event.target.value)}><option value="">Select a customer</option>{customersQuery.data?.data.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.customer_code}</option>)}</SelectInput></FormField>
                    <FormField htmlFor="order-date" label="Order date" error={errors.order_date?.[0]}><TextInput id="order-date" type="date" required value={orderDate} hasError={Boolean(errors.order_date?.[0])} onChange={(event) => setOrderDate(event.target.value)} /></FormField>
                    <FormField htmlFor="order-expected" label="Expected delivery date" error={errors.expected_delivery_date?.[0]}><TextInput id="order-expected" type="date" value={expectedDate} hasError={Boolean(errors.expected_delivery_date?.[0])} onChange={(event) => setExpectedDate(event.target.value)} /></FormField>
                    <FormField htmlFor="order-discount" label="Order discount" error={errors.discount_amount?.[0]}><TextInput id="order-discount" type="number" min="0" step="0.01" value={discount} hasError={Boolean(errors.discount_amount?.[0])} onChange={(event) => setDiscount(Number(event.target.value))} /></FormField>
                    <FormField htmlFor="order-tax" label="Tax" error={errors.tax?.[0]}><TextInput id="order-tax" type="number" min="0" step="0.01" value={tax} hasError={Boolean(errors.tax?.[0])} onChange={(event) => setTax(Number(event.target.value))} /></FormField>
                </div>
                <section className="order-items-editor" aria-labelledby="order-items-heading">
                    <div className="list-toolbar__heading"><h2 id="order-items-heading">Products</h2><Button type="button" variant="secondary" onClick={() => setItems((current) => [...current, emptyLine()])}>Add product</Button></div>
                    <TextInput aria-label="Search products for order" placeholder="Search active products by name or SKU" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} />
                    {errors.items?.[0] && <p className="field-error" role="alert">{errors.items[0]}</p>}
                    {items.map((item, index) => {
                        const selected = productMap.get(item.product_id);
                        const lineTotal = Math.max(0, item.quantity * item.unit_price - item.discount_amount);
                        return <Card className="order-item-card" key={`line-${index}`}>
                            <div className="form-grid">
                                <FormField htmlFor={`product-${index}`} label={`Product ${index + 1}`} error={lineError(index, 'product_id')}>
                                    <SelectInput id={`product-${index}`} required value={item.product_id || ''} hasError={Boolean(lineError(index, 'product_id'))} onChange={(event) => selectProduct(index, event.target.value)}>
                                        <option value="">Select product</option>{visibleProducts.map((product: SalesProduct) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}
                                    </SelectInput>
                                </FormField>
                                <FormField htmlFor={`quantity-${index}`} label="Quantity" error={lineError(index, 'quantity')}><TextInput id={`quantity-${index}`} required type="number" min="1" step="1" value={item.quantity} hasError={Boolean(lineError(index, 'quantity'))} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} /></FormField>
                                <FormField htmlFor={`price-${index}`} label="Unit price" error={lineError(index, 'unit_price')}><TextInput id={`price-${index}`} required type="number" min="0" step="0.01" value={item.unit_price} hasError={Boolean(lineError(index, 'unit_price'))} onChange={(event) => updateItem(index, { unit_price: Number(event.target.value) })} /></FormField>
                                <FormField htmlFor={`line-discount-${index}`} label="Line discount" error={lineError(index, 'discount_amount')}><TextInput id={`line-discount-${index}`} type="number" min="0" step="0.01" value={item.discount_amount} hasError={Boolean(lineError(index, 'discount_amount'))} onChange={(event) => updateItem(index, { discount_amount: Number(event.target.value) })} /></FormField>
                            </div>
                            <div className="order-line-summary">
                                <span>{selected ? `${selected.available_quantity} available · ${selected.reserved_quantity} reserved` : 'Select a product to see availability'}</span>
                                {selected && item.quantity > selected.available_quantity && <strong className="field-error">Requested quantity exceeds current availability. The server will re-check when confirming.</strong>}
                                <strong>Line total: {money(lineTotal)}</strong>
                                {items.length > 1 && <Button type="button" variant="quiet" onClick={() => setItems((current) => current.filter((_row, row) => row !== index))}>Remove</Button>}
                            </div>
                        </Card>;
                    })}
                </section>
                <FormField htmlFor="order-notes" label="Notes" error={errors.notes?.[0]}><textarea id="order-notes" className="form-control" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} /></FormField>
                <div className="order-total-summary"><span>Subtotal <strong>{money(subtotal)}</strong></span><span>Order discount <strong>−{money(discount)}</strong></span><span>Tax <strong>{money(tax)}</strong></span><span className="order-grand-total">Total <strong>{money(total)}</strong></span></div>
                <div className="form-actions"><Button type="button" variant="secondary" onClick={() => navigate('/orders')}>Cancel</Button><Button type="submit" disabled={mutation.isPending || items.length === 0}>{mutation.isPending ? 'Saving…' : 'Save draft'}</Button></div>
            </form></Card>
        </>
    );
}
