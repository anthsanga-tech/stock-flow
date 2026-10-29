import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { Button, Card, ConfirmDialog, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { changePurchaseOrderStatus, getPurchaseOrder } from './api';
import type { PurchaseOrderSummary } from './types';
import { useAuth } from '../../auth/AuthProvider';

function remaining(item: { quantity: number; received_quantity: number }): number {
    return Math.max(item.quantity - item.received_quantity, 0);
}

export function PurchaseOrderDetailsPage() {
    const { id } = useParams();
    const orderId = Number(id);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [confirmCancel, setConfirmCancel] = useState(false);
    const orderQuery = useQuery({
        queryKey: ['purchase-order', orderId],
        queryFn: () => getPurchaseOrder(orderId),
        enabled: Number.isInteger(orderId) && orderId > 0,
    });
    const statusMutation = useMutation({
        mutationFn: (action: 'submit' | 'approve' | 'cancel') => changePurchaseOrderStatus(orderId, action),
        onSuccess: async (order) => {
            setConfirmCancel(false);
            await queryClient.invalidateQueries({ queryKey: ['purchase-order', order.id] });
            await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
        },
    });

    if (!Number.isInteger(orderId) || orderId < 1) return <ErrorState title="Invalid purchase order" message="The purchase-order identifier is not valid." />;
    if (orderQuery.isPending) return <LoadingState label="Loading purchase order…" />;
    if (orderQuery.isError || !orderQuery.data) {
        return <ErrorState title="Purchase order could not be loaded" message={getErrorMessage(orderQuery.error, 'Try again in a moment.')} action={<Button onClick={() => void orderQuery.refetch()}>Try again</Button>} />;
    }

    const order = orderQuery.data;
    const canManage = Boolean(user?.permissions.includes('suppliers.manage'));
    const hasOutstanding = order.items.some((item) => remaining(item) > 0);
    const showCancel = canManage && ['draft', 'submitted', 'approved'].includes(order.status);

    function runAction(action: 'submit' | 'approve') {
        statusMutation.mutate(action);
    }

    return (
        <>
            <PageHeader
                title={order.order_number}
                description={`${order.supplier.name} · Ordered ${order.order_date}`}
                eyebrow="PURCHASE ORDER"
                actions={
                    <div className="page-header__actions">
                        {canManage && order.status === 'draft' && <Button variant="secondary" onClick={() => navigate(`/purchase-orders/${order.id}/edit`)}>Edit draft</Button>}
                        {canManage && order.status === 'draft' && <Button disabled={statusMutation.isPending} onClick={() => runAction('submit')}>Submit for approval</Button>}
                        {canManage && order.status === 'submitted' && <Button disabled={statusMutation.isPending} onClick={() => runAction('approve')}>Approve order</Button>}
                        {canManage && ['approved', 'partially_received'].includes(order.status) && hasOutstanding && <Button onClick={() => navigate(`/purchase-orders/${order.id}/receive`)}>Receive goods</Button>}
                        {showCancel && <Button variant="danger" onClick={() => setConfirmCancel(true)}>Cancel order</Button>}
                    </div>
                }
            />
            {statusMutation.isError && <div className="notice notice--error" role="alert">{getErrorMessage(statusMutation.error, 'The purchase-order status could not be updated.')}</div>}
            <Card className="detail-card">
                <dl className="detail-grid">
                    <div><dt>Supplier</dt><dd><Link to={`/suppliers/${order.supplier.id}`}>{order.supplier.name} · {order.supplier.supplier_code}</Link></dd></div>
                    <div><dt>Status</dt><dd><span className={`purchase-status purchase-status--${order.status}`}>{order.status.replaceAll('_', ' ')}</span></dd></div>
                    <div><dt>Order date</dt><dd>{order.order_date}</dd></div>
                    <div><dt>Expected delivery</dt><dd>{order.expected_delivery_date ?? 'Not set'}</dd></div>
                    <div><dt>Subtotal</dt><dd>{Number(order.subtotal).toFixed(2)}</dd></div>
                    <div><dt>Total</dt><dd>{Number(order.total).toFixed(2)}</dd></div>
                    <div><dt>Notes</dt><dd>{order.notes || '—'}</dd></div>
                </dl>
            </Card>
            <Card className="product-list-card purchasing-list-card">
                <div className="list-toolbar__heading"><h2>Ordered products</h2><span>{order.items.length} lines</span></div>
                <div className="table-scroll">
                    <table className="product-table">
                        <thead><tr><th>Product</th><th>Ordered</th><th>Received</th><th>Outstanding</th><th>Unit cost</th><th>Line subtotal</th></tr></thead>
                        <tbody>{order.items.map((item) => (
                            <tr key={item.id}>
                                <td><strong>{item.name_snapshot}</strong><small>{item.sku_snapshot}</small></td>
                                <td>{item.quantity}</td><td>{item.received_quantity}</td><td>{remaining(item)}</td>
                                <td>{Number(item.unit_cost).toFixed(2)}</td><td>{Number(item.line_subtotal).toFixed(2)}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </Card>
            <Card className="product-list-card purchasing-list-card">
                <div className="list-toolbar__heading"><h2>Status history</h2><span>Order lifecycle</span></div>
                <ol className="purchase-timeline">
                    {order.status_history?.map((entry) => (
                        <li key={entry.id}>
                            <strong>{entry.to_status.replaceAll('_', ' ')}</strong>
                            <span>{entry.from_status ? `From ${entry.from_status.replaceAll('_', ' ')}` : 'Order created'}</span>
                            <small>{new Date(entry.created_at).toLocaleString()} · {entry.changer?.name ?? 'Unknown user'}</small>
                        </li>
                    ))}
                </ol>
            </Card>
            <Card className="product-list-card purchasing-list-card">
                <div className="list-toolbar__heading"><h2>Goods receipts</h2><span>{order.receipts.length} deliveries</span></div>
                {order.receipts.length === 0 ? <p className="empty-inline">No deliveries recorded.</p> : (
                    <div className="table-scroll">
                        <table className="product-table">
                            <thead><tr><th>Receipt</th><th>Date</th><th>Delivery reference</th><th>Lines</th></tr></thead>
                            <tbody>{order.receipts.map((receipt) => (
                                <tr key={receipt.id}><td><Link to={`/goods-receipts/${receipt.id}`}>{receipt.receipt_number}</Link></td><td>{receipt.received_at?.slice(0, 10) ?? '—'}</td><td>{receipt.delivery_reference || '—'}</td><td>{receipt.items?.length ?? '—'}</td></tr>
                            ))}</tbody>
                        </table>
                    </div>
                )}
            </Card>
            <ConfirmDialog
                isOpen={confirmCancel}
                title="Cancel purchase order?"
                message="This action is recorded in the order history and cannot be undone."
                confirmLabel="Cancel order"
                cancelLabel="Keep order"
                pendingLabel="Cancelling…"
                isPending={statusMutation.isPending}
                onCancel={() => setConfirmCancel(false)}
                onConfirm={() => statusMutation.mutate('cancel')}
            />
        </>
    );
}
