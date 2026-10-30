import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { Button, Card, ErrorState, Icon, LoadingState, PageHeader } from '../../components/ui';
import { getSalesOrder, transitionSalesOrder } from './api';

const money = (value: string) => Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function SalesOrderDetailsPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const orderId = Number(id);
    const { user } = useAuth();
    const canManage = Boolean(user?.permissions.includes('orders.manage'));
    const query = useQuery({ queryKey: ['sales-order', orderId], queryFn: () => getSalesOrder(orderId), enabled: Number.isInteger(orderId) && orderId > 0 });
    const mutation = useMutation({
        mutationFn: (action: 'confirm' | 'process' | 'complete' | 'cancel') => transitionSalesOrder(orderId, action),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['sales-order', orderId] });
            await queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
            await queryClient.invalidateQueries({ queryKey: ['customers'] });
        },
    });
    if (!Number.isInteger(orderId) || orderId < 1) return <ErrorState title="Invalid sales order" message="The order identifier is not valid." />;
    if (query.isPending) return <LoadingState label="Loading sales order…" />;
    if (query.isError || !query.data) return <ErrorState title="Sales order could not be loaded" message={getErrorMessage(query.error, 'Try again in a moment.')} />;
    const order = query.data;
    const allowedActions: Array<'confirm' | 'process' | 'complete' | 'cancel'> = order.status === 'draft'
        ? ['confirm', 'cancel']
        : order.status === 'confirmed'
            ? ['process', 'cancel']
            : order.status === 'processing'
                ? ['complete', 'cancel']
                : [];
    const actionLabels = { confirm: 'Confirm and reserve stock', process: 'Start processing', complete: 'Complete and deduct stock', cancel: 'Cancel order' };

    function runAction(action: 'confirm' | 'process' | 'complete' | 'cancel') {
        const detail = action === 'confirm'
            ? 'Confirm this order and reserve all required stock?'
            : action === 'complete'
                ? 'Complete fulfillment and deduct the reserved quantities from stock?'
                : action === 'cancel'
                    ? 'Cancel this order? Any active reservations will be released.'
                    : 'Start preparing this order?';
        if (window.confirm(detail)) mutation.mutate(action);
    }

    return (
        <>
            <Button className="sales-order-back-button" variant="secondary" size="small" onClick={() => navigate('/orders')}>
                <Icon name="arrow-left" size={15} /> Back to sales orders
            </Button>
            <nav className="breadcrumbs" aria-label="Breadcrumb"><button type="button" onClick={() => navigate('/orders')}>Sales orders</button><span aria-hidden="true">/</span><span>{order.order_number}</span></nav>
            <PageHeader title={order.order_number} description={`Created by ${order.creator?.name ?? '—'} · ${order.order_date}`} eyebrow="SALES ORDER" actions={<>
                {canManage && order.status === 'draft' && <Button variant="secondary" onClick={() => navigate(`/orders/${order.id}/edit`)}>Edit draft</Button>}
                {canManage && allowedActions.map((action) => <Button key={action} variant={action === 'cancel' ? 'danger' : 'primary'} disabled={mutation.isPending} onClick={() => runAction(action)}>{actionLabels[action]}</Button>)}
            </>} />
            {mutation.isError && <div className="notice notice--error" role="alert">{getErrorMessage(mutation.error, 'The order status could not be changed.')}</div>}
            <div className="dashboard-grid">
                <Card className="sales-order-info-card"><h2>Order details</h2><dl className="detail-list">
                    <dt>Status</dt><dd><span className="status-badge status-badge--neutral">{order.status}</span></dd><dt>Order date</dt><dd>{order.order_date}</dd><dt>Expected delivery</dt><dd>{order.expected_delivery_date || '—'}</dd><dt>Notes</dt><dd>{order.notes || '—'}</dd>
                </dl></Card>
                <Card className="sales-order-info-card"><h2>Customer</h2><p><Link to={`/customers/${order.customer.id}`}>{order.customer.name}</Link></p><p>{order.customer.customer_code}{order.customer.company_name ? ` · ${order.customer.company_name}` : ''}</p><p>{order.customer.email || order.customer.phone || '—'}</p><p>{order.customer.shipping_address || order.customer.billing_address || '—'}</p></Card>
            </div>
            <Card className="product-list-card"><h2>Items and stock reservations</h2><div className="table-scroll sales-table-scroll"><table className="product-table">
                <thead><tr><th>Product</th><th>Quantity</th><th>Unit price</th><th>Discount</th><th>Line total</th><th>Reservation</th></tr></thead>
                <tbody>{order.items.map((item) => <tr key={item.id}><td><strong>{item.name_snapshot}</strong><small>{item.sku_snapshot}</small></td><td>{item.quantity}</td><td>{money(item.unit_price)}</td><td>{money(item.discount_amount)}</td><td>{money(item.line_total)}</td><td>{item.reservation ? `${item.reservation.reserved_quantity} ${item.reservation.status}` : 'Not reserved'}</td></tr>)}</tbody>
            </table></div>
                <div className="order-total-summary sales-order-total-summary"><span>Subtotal <strong>{money(order.subtotal)}</strong></span><span>Order discount <strong>−{money(order.discount)}</strong></span><span>Tax <strong>{money(order.tax)}</strong></span><span className="order-grand-total">Total <strong>{money(order.total)}</strong></span></div>
            </Card>
            <Card className="product-list-card"><h2>Order activity</h2>{order.status_history.length === 0 ? <p className="muted-copy">No status changes recorded.</p> : <ol className="activity-list">{order.status_history.map((entry) => <li key={entry.id}><strong>{entry.to_status}</strong><span>{entry.from_status ? `from ${entry.from_status} · ` : ''}{entry.changer?.name ?? 'System'} · {new Date(entry.created_at).toLocaleString()}</span></li>)}</ol>}</Card>
        </>
    );
}
