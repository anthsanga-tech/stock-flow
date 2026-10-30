import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { Button, Card, ErrorState, Icon, LoadingState, PageHeader } from '../../components/ui';
import { useAuth } from '../../auth/AuthProvider';
import { getCustomer } from './api';

const money = (value?: string | null) => Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CustomerDetailsPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const customerId = Number(id);
    const { user } = useAuth();
    const query = useQuery({ queryKey: ['customer', customerId], queryFn: () => getCustomer(customerId), enabled: Number.isInteger(customerId) && customerId > 0 });
    if (!Number.isInteger(customerId) || customerId < 1) return <ErrorState title="Invalid customer" message="The customer identifier is not valid." />;
    if (query.isPending) return <LoadingState label="Loading customer…" />;
    if (query.isError || !query.data) return <ErrorState title="Customer could not be loaded" message={getErrorMessage(query.error, 'Try again in a moment.')} />;
    const customer = query.data;

    return (
        <>
            <Button className="sales-order-back-button" variant="secondary" size="small" onClick={() => navigate('/customers')}>
                <Icon name="arrow-left" size={15} /> Back to customers
            </Button>
            <nav className="breadcrumbs" aria-label="Breadcrumb"><button type="button" onClick={() => navigate('/customers')}>Customers</button><span aria-hidden="true">/</span><span>{customer.customer_code}</span></nav>
            <PageHeader title={customer.name} description={customer.company_name || customer.customer_code} eyebrow="CUSTOMER" actions={user?.permissions.includes('customers.manage') ? <Button variant="secondary" onClick={() => navigate(`/customers/${customer.id}/edit`)}>Edit customer</Button> : undefined} />
            <div className="dashboard-grid">
                <Card className="customer-info-card"><h2>Customer overview</h2><dl className="detail-list">
                    <dt>Customer code</dt><dd>{customer.customer_code}</dd><dt>Status</dt><dd><span className={`status-badge ${customer.status === 'active' ? 'status-badge--success' : 'status-badge--neutral'}`}>{customer.status}</span></dd>
                    <dt>Email</dt><dd>{customer.email || '—'}</dd><dt>Phone</dt><dd>{customer.phone || '—'}</dd><dt>Billing address</dt><dd>{customer.billing_address || customer.address || '—'}</dd><dt>Shipping address</dt><dd>{customer.shipping_address || '—'}</dd><dt>Notes</dt><dd>{customer.notes || '—'}</dd>
                </dl></Card>
                <Card className="customer-info-card"><h2>Sales summary</h2><dl className="detail-list"><dt>Total orders</dt><dd>{customer.orders_count ?? 0}</dd><dt>Total order value</dt><dd>{money(customer.orders_sum_total)}</dd><dt>Outstanding orders</dt><dd>{customer.outstanding_orders_count ?? 0}</dd></dl></Card>
            </div>
            <Card className="product-list-card"><div className="list-toolbar__heading"><h2>Order history</h2><Link to={`/orders?customer_id=${customer.id}`}>View all sales orders</Link></div>
                {!customer.orders?.length ? <p className="muted-copy">No sales orders for this customer yet.</p> : <div className="table-scroll sales-table-scroll"><table className="product-table">
                    <thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Items</th><th>Total</th></tr></thead>
                    <tbody>{customer.orders.map((order) => <tr key={order.id}><td><Link to={`/orders/${order.id}`}>{order.order_number}</Link></td><td>{order.order_date}</td><td><span className="status-badge status-badge--neutral">{order.status}</span></td><td>{order.items_count ?? 0}</td><td>{money(order.total)}</td></tr>)}</tbody>
                </table></div>}
            </Card>
        </>
    );
}
