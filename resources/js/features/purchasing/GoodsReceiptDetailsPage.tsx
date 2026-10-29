import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getErrorMessage } from '../../api/client';
import { Button, Card, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { getGoodsReceipt } from './api';

export function GoodsReceiptDetailsPage() {
    const { id } = useParams();
    const receiptId = Number(id);
    const navigate = useNavigate();
    const receiptQuery = useQuery({
        queryKey: ['goods-receipt', receiptId],
        queryFn: () => getGoodsReceipt(receiptId),
        enabled: Number.isInteger(receiptId) && receiptId > 0,
    });

    if (!Number.isInteger(receiptId) || receiptId < 1) return <ErrorState title="Invalid goods receipt" message="The receipt identifier is not valid." />;
    if (receiptQuery.isPending) return <LoadingState label="Loading receipt details…" />;
    if (receiptQuery.isError || !receiptQuery.data) {
        return <ErrorState title="Goods receipt could not be loaded" message={getErrorMessage(receiptQuery.error, 'Try again in a moment.')} action={<Button onClick={() => void receiptQuery.refetch()}>Try again</Button>} />;
    }

    const receipt = receiptQuery.data;

    return (
        <>
            <PageHeader
                title={receipt.receipt_number}
                description={receipt.supplier?.name ?? 'Supplier receipt'}
                eyebrow="GOODS RECEIPT"
                actions={<Button variant="secondary" onClick={() => navigate('/goods-receipts')}>Receipt history</Button>}
            />
            <Card className="detail-card">
                <dl className="detail-grid">
                    <div><dt>Purchase order</dt><dd>{receipt.purchase_order ? <Link to={`/purchase-orders/${receipt.purchase_order.id}`}>{receipt.purchase_order.order_number}</Link> : 'Legacy receipt'}</dd></div>
                    <div><dt>Supplier</dt><dd>{receipt.supplier?.name ?? '—'}</dd></div>
                    <div><dt>Receipt date</dt><dd>{receipt.received_at?.slice(0, 10) ?? '—'}</dd></div>
                    <div><dt>Delivery reference</dt><dd>{receipt.delivery_reference || '—'}</dd></div>
                    <div><dt>Received by</dt><dd>{receipt.creator?.name ?? 'Unknown user'}</dd></div>
                    <div><dt>Notes</dt><dd>{receipt.notes || '—'}</dd></div>
                </dl>
            </Card>
            <Card className="product-list-card purchasing-list-card">
                <div className="list-toolbar__heading"><h2>Received products</h2><span>{receipt.items?.length ?? 0} lines</span></div>
                <div className="table-scroll">
                    <table className="product-table">
                        <thead><tr><th>Product</th><th>Quantity</th><th>Unit cost snapshot</th></tr></thead>
                        <tbody>{receipt.items?.map((item) => (
                            <tr key={item.id}>
                                <td><strong>{item.name_snapshot ?? item.product?.name ?? `Product #${item.product_id}`}</strong><small>{item.sku_snapshot ?? item.product?.sku ?? 'Product unavailable'}</small></td>
                                <td>{item.quantity}</td><td>{Number(item.unit_cost).toFixed(2)}</td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            </Card>
        </>
    );
}
