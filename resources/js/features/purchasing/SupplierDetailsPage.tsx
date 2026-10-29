import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { Button, Card, ConfirmDialog, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { useAuth } from '../../auth/AuthProvider';
import { deactivateSupplier, getSupplier, getSupplierPurchaseOrders } from './api';

export function SupplierDetailsPage() {
    const { id } = useParams();
    const supplierId = Number(id);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const [confirmDeactivate, setConfirmDeactivate] = useState(false);
    const [purchasePage, setPurchasePage] = useState(1);
    const supplierQuery = useQuery({
        queryKey: ['supplier', supplierId],
        queryFn: () => getSupplier(supplierId),
        enabled: Number.isInteger(supplierId) && supplierId > 0,
    });
    const purchaseOrdersQuery = useQuery({
        queryKey: ['supplier-purchase-orders', supplierId, purchasePage],
        queryFn: () => getSupplierPurchaseOrders(supplierId, purchasePage),
        enabled: Number.isInteger(supplierId) && supplierId > 0,
    });
    const deactivateMutation = useMutation({
        mutationFn: () => deactivateSupplier(supplierId),
        onSuccess: async () => {
            setConfirmDeactivate(false);
            await queryClient.invalidateQueries({ queryKey: ['supplier', supplierId] });
            await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
        },
    });

    if (!Number.isInteger(supplierId) || supplierId < 1) return <ErrorState title="Invalid supplier" message="The supplier identifier is not valid." />;
    if (supplierQuery.isPending) return <LoadingState label="Loading supplier details…" />;
    if (supplierQuery.isError || !supplierQuery.data) {
        return <ErrorState title="Supplier could not be loaded" message={getErrorMessage(supplierQuery.error, 'Try again in a moment.')} action={<Button onClick={() => void supplierQuery.refetch()}>Try again</Button>} />;
    }

    const supplier = supplierQuery.data;
    const canManage = Boolean(user?.permissions.includes('suppliers.manage'));

    return (
        <>
            <PageHeader
                title={supplier.name}
                description={`${supplier.supplier_code} · Supplier details`}
                eyebrow="SUPPLIER"
                actions={
                    <div className="page-header__actions">
                        <Button variant="secondary" onClick={() => navigate('/suppliers')}>Back to suppliers</Button>
                        {canManage && <Button variant="secondary" onClick={() => navigate(`/suppliers/${supplier.id}/edit`)}>Edit supplier</Button>}
                        {canManage && supplier.is_active && <Button variant="danger" onClick={() => setConfirmDeactivate(true)}>Deactivate</Button>}
                        {canManage && supplier.is_active && <Button variant="quiet" onClick={() => navigate(`/purchase-orders/new?supplier_id=${supplier.id}`)}>Create purchase order</Button>}
                    </div>
                }
            />
            {deactivateMutation.isError && <div className="notice notice--error" role="alert">{getErrorMessage(deactivateMutation.error, 'The supplier could not be deactivated.')}</div>}
            <Card className="detail-card">
                <div className="form-card__heading"><h2>Contact information</h2></div>
                <dl className="detail-grid">
                    <div><dt>Status</dt><dd>{supplier.is_active ? 'Active' : 'Inactive'}</dd></div>
                    <div><dt>Outstanding orders</dt><dd>{supplier.outstanding_purchase_orders_count ?? 0}</dd></div>
                    <div><dt>Contact person</dt><dd>{supplier.contact_person || '—'}</dd></div>
                    <div><dt>Email</dt><dd>{supplier.email || '—'}</dd></div>
                    <div><dt>Phone</dt><dd>{supplier.phone || '—'}</dd></div>
                    <div><dt>Address</dt><dd>{supplier.address || '—'}</dd></div>
                    <div><dt>Notes</dt><dd>{supplier.notes || '—'}</dd></div>
                </dl>
            </Card>
            <Card className="product-list-card purchasing-list-card">
                <div className="list-toolbar__heading"><h2>Purchase-order history</h2><span>{supplier.purchase_orders_count ?? 0} total</span></div>
                {purchaseOrdersQuery.isPending ? <LoadingState label="Loading purchase-order history…" /> : purchaseOrdersQuery.isError ? (
                    <ErrorState title="Purchase-order history could not be loaded" message={getErrorMessage(purchaseOrdersQuery.error, 'Try again in a moment.')} />
                ) : (purchaseOrdersQuery.data?.data ?? []).length === 0 ? (
                    <div className="state-panel state-panel--empty"><p>No purchase orders for this supplier yet.</p></div>
                ) : (
                    <div className="table-scroll">
                        <table className="product-table">
                            <thead><tr><th>Order</th><th>Order date</th><th>Expected</th><th>Status</th><th>Total</th></tr></thead>
                            <tbody>{purchaseOrdersQuery.data?.data.map((order) => (
                                <tr key={order.id}>
                                    <td><Link to={`/purchase-orders/${order.id}`}>{order.order_number}</Link></td>
                                    <td>{order.order_date}</td>
                                    <td>{order.expected_delivery_date ?? '—'}</td>
                                    <td>{order.status.replaceAll('_', ' ')}</td>
                                    <td>{Number(order.total).toFixed(2)}</td>
                                </tr>
                            ))}</tbody>
                        </table>
                    </div>
                )}
                {(purchaseOrdersQuery.data?.last_page ?? 1) > 1 && (
                    <nav className="pagination" aria-label="Supplier purchase-order pages">
                        <span className="pagination__summary">{purchaseOrdersQuery.data?.total ?? 0} orders · Page {purchasePage} of {purchaseOrdersQuery.data?.last_page}</span>
                        <div className="pagination__controls">
                            <Button size="small" variant="secondary" disabled={purchasePage <= 1} onClick={() => setPurchasePage((value) => value - 1)}>Previous</Button>
                            <Button size="small" variant="secondary" disabled={purchasePage >= (purchaseOrdersQuery.data?.last_page ?? 1)} onClick={() => setPurchasePage((value) => value + 1)}>Next</Button>
                        </div>
                    </nav>
                )}
                <div className="form-actions"><Link to={`/goods-receipts?supplier_id=${supplier.id}`}>View receipt history</Link></div>
            </Card>
            <ConfirmDialog
                isOpen={confirmDeactivate}
                title="Deactivate supplier?"
                message="The supplier will no longer be selectable for new purchase orders. Existing purchasing history is retained."
                confirmLabel="Deactivate supplier"
                cancelLabel="Keep supplier"
                pendingLabel="Deactivating…"
                isPending={deactivateMutation.isPending}
                onCancel={() => setConfirmDeactivate(false)}
                onConfirm={() => deactivateMutation.mutate()}
            />
        </>
    );
}
