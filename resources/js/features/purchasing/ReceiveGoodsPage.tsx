import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { getErrorMessage, getValidationErrors } from '../../api/client';
import { Button, Card, ErrorState, FormField, LoadingState, PageHeader, TextInput } from '../../components/ui';
import { getPurchaseOrder, receiveGoods } from './api';

function newIdempotencyKey(): string {
    return globalThis.crypto.randomUUID();
}

export function ReceiveGoodsPage() {
    const { id } = useParams();
    const orderId = Number(id);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 10));
    const [deliveryReference, setDeliveryReference] = useState('');
    const [notes, setNotes] = useState('');
    const [quantities, setQuantities] = useState<Record<number, string>>({});
    const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
    const orderQuery = useQuery({
        queryKey: ['purchase-order', orderId],
        queryFn: () => getPurchaseOrder(orderId),
        enabled: Number.isInteger(orderId) && orderId > 0,
    });
    const mutation = useMutation({
        mutationFn: () => receiveGoods(orderId, {
            idempotency_key: idempotencyKey,
            received_at: receivedAt,
            delivery_reference: deliveryReference.trim(),
            notes: notes.trim(),
            items: Object.entries(quantities)
                .map(([itemId, quantity]) => ({ purchase_order_item_id: Number(itemId), quantity: Number(quantity) }))
                .filter((line) => line.quantity > 0),
        }),
        onSuccess: async (receipt) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['purchase-order', orderId] }),
                queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }),
                queryClient.invalidateQueries({ queryKey: ['goods-receipts'] }),
                queryClient.invalidateQueries({ queryKey: ['inventory'] }),
                queryClient.invalidateQueries({ queryKey: ['inventory-movements'] }),
                queryClient.invalidateQueries({ queryKey: ['stock-balances'] }),
                queryClient.invalidateQueries({ queryKey: ['supplier', receipt.supplier_id] }),
                queryClient.invalidateQueries({ queryKey: ['supplier-purchase-orders', receipt.supplier_id] }),
            ]);
            setIdempotencyKey(newIdempotencyKey());
            navigate(`/goods-receipts/${receipt.id}`, { replace: true });
        },
        onError: (error: unknown) => {
            const errors = getValidationErrors(error);
            const submittedIds = Object.entries(quantities)
                .filter(([, quantity]) => Number(quantity) > 0)
                .map(([itemId]) => Number(itemId));
            const mappedErrors = { ...errors };
            Object.entries(errors).forEach(([key, messages]) => {
                const match = /^items\.(\d+)\.quantity$/.exec(key);
                if (match) {
                    mappedErrors[`items.${submittedIds[Number(match[1])]}.quantity`] = messages;
                }
            });
            setFieldErrors(mappedErrors);
        },
    });

    if (!Number.isInteger(orderId) || orderId < 1) return <ErrorState title="Invalid purchase order" message="The purchase-order identifier is not valid." />;
    if (orderQuery.isPending) return <LoadingState label="Loading outstanding quantities…" />;
    if (orderQuery.isError || !orderQuery.data) return <ErrorState title="Purchase order could not be loaded" message={getErrorMessage(orderQuery.error, 'Try again in a moment.')} />;
    const order = orderQuery.data;
    if (!['approved', 'partially_received'].includes(order.status)) {
        return <ErrorState title="Order cannot be received" message="Only approved orders with outstanding items can receive goods." action={<Button onClick={() => navigate(`/purchase-orders/${order.id}`)}>View order</Button>} />;
    }

    const outstandingItems = order.items.filter((item) => item.quantity > item.received_quantity);
    const linesToReceive = Object.values(quantities).some((value) => Number(value) > 0);

    function submit() {
        setFieldErrors({});
        if (!linesToReceive) {
            setFieldErrors({ items: ['Enter a quantity for at least one outstanding item.'] });
            return;
        }
        if (!window.confirm('Confirm these delivered quantities and update inventory?')) return;
        mutation.mutate();
    }

    return (
        <>
            <nav className="breadcrumbs" aria-label="Breadcrumb"><button type="button" onClick={() => navigate(`/purchase-orders/${order.id}`)}>Purchase order {order.order_number}</button><span aria-hidden="true">/</span><span>Receive goods</span></nav>
            <PageHeader title="Receive goods" description={`Record a delivery from ${order.supplier.name}. Inventory updates only when this receipt is confirmed.`} />
            {mutation.isError && <div className="notice notice--error" role="alert">{getErrorMessage(mutation.error, 'The delivery could not be recorded. Check quantities and try again.')}</div>}
            <Card className="form-card">
                <div className="form-grid">
                    <FormField htmlFor="receipt-date" label="Receipt date" error={fieldErrors.received_at?.[0]}>
                        <TextInput id="receipt-date" type="date" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} />
                    </FormField>
                    <FormField htmlFor="delivery-reference" label="Delivery note / reference" error={fieldErrors.delivery_reference?.[0]}>
                        <TextInput id="delivery-reference" value={deliveryReference} onChange={(event) => setDeliveryReference(event.target.value)} />
                    </FormField>
                    <FormField htmlFor="receipt-notes" label="Notes" error={fieldErrors.notes?.[0]}>
                        <TextInput id="receipt-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
                    </FormField>
                </div>
                <div className="table-scroll purchase-receiving-table">
                    <table className="product-table">
                        <thead><tr><th>Product</th><th>Ordered</th><th>Previously received</th><th>Outstanding</th><th>Receiving now</th></tr></thead>
                        <tbody>{outstandingItems.map((item) => {
                            const outstanding = item.quantity - item.received_quantity;
                            const error = fieldErrors[`items.${item.id}.quantity`]?.[0];
                            return (
                                <tr key={item.id}>
                                    <td><strong>{item.name_snapshot}</strong><small>{item.sku_snapshot}</small></td>
                                    <td>{item.quantity}</td><td>{item.received_quantity}</td><td>{outstanding}</td>
                                    <td>
                                        <TextInput aria-label={`Quantity received for ${item.name_snapshot}`} type="number" min="0" max={outstanding} step="1" value={quantities[item.id] ?? '0'} hasError={Boolean(error)} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: event.target.value }))} />
                                        {error && <span className="form-error" role="alert">{error}</span>}
                                    </td>
                                </tr>
                            );
                        })}</tbody>
                    </table>
                </div>
                {fieldErrors.items?.[0] && <p className="form-error" role="alert">{fieldErrors.items[0]}</p>}
                <div className="form-actions">
                    <Button variant="secondary" onClick={() => navigate(`/purchase-orders/${order.id}`)}>Back to order</Button>
                    <Button disabled={mutation.isPending || !linesToReceive} onClick={submit}>{mutation.isPending ? 'Recording receipt…' : 'Confirm receipt'}</Button>
                </div>
            </Card>
        </>
    );
}
