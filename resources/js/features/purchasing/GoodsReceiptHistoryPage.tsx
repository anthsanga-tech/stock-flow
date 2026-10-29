import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { getErrorMessage } from '../../api/client';
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, SelectInput, TextInput } from '../../components/ui';
import { getGoodsReceipts, getPurchaseOrders, getSuppliers } from './api';
import type { PurchaseOrderFilters, ReceiptFilters, SupplierFilters } from './types';

export function GoodsReceiptHistoryPage() {
    const [searchParams] = useSearchParams();
    const [search, setSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');
    const [supplierId, setSupplierId] = useState(searchParams.get('supplier_id') ?? '');
    const [purchaseOrderId, setPurchaseOrderId] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [reference, setReference] = useState('');
    const [page, setPage] = useState(1);
    useEffect(() => {
        const timer = window.setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, 250);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    const supplierFilters: SupplierFilters = { sort_by: 'name', sort_direction: 'asc', page: 1, per_page: 100 };
    const orderFilters: PurchaseOrderFilters = { page: 1, per_page: 100 };
    const supplierQuery = useQuery({ queryKey: ['suppliers', supplierFilters], queryFn: () => getSuppliers(supplierFilters) });
    const orderQuery = useQuery({ queryKey: ['purchase-orders', orderFilters], queryFn: () => getPurchaseOrders(orderFilters) });
    const filters = useMemo<ReceiptFilters>(() => ({
        ...(supplierId ? { supplier_id: Number(supplierId) } : {}),
        ...(purchaseOrderId ? { purchase_order_id: Number(purchaseOrderId) } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(reference ? { reference } : {}),
        ...(search ? { search } : {}),
        page,
        per_page: 15,
    }), [supplierId, purchaseOrderId, from, to, reference, search, page]);
    const receiptsQuery = useQuery({
        queryKey: ['goods-receipts', filters],
        queryFn: () => getGoodsReceipts(filters),
    });
    const receipts = receiptsQuery.data?.data ?? [];

    return (
        <>
            <PageHeader title="Goods receipt history" description="Review recorded supplier deliveries and received quantities." eyebrow="PURCHASING" />
            <Card className="product-list-card purchasing-list-card">
                <div className="list-toolbar">
                    <div className="list-toolbar__heading"><h2>Receipts</h2><span>{receiptsQuery.data?.total ?? '—'} total</span></div>
                    <div className="filter-bar" role="search">
                        <TextInput aria-label="Search receipts" placeholder="Receipt number or reference" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} />
                        <SelectInput aria-label="Filter receipts by supplier" value={supplierId} onChange={(event) => { setSupplierId(event.target.value); setPage(1); }}>
                            <option value="">All suppliers</option>{supplierQuery.data?.data.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                        </SelectInput>
                        <SelectInput aria-label="Filter receipts by purchase order" value={purchaseOrderId} onChange={(event) => { setPurchaseOrderId(event.target.value); setPage(1); }}>
                            <option value="">All purchase orders</option>{orderQuery.data?.data.map((order) => <option key={order.id} value={order.id}>{order.order_number}</option>)}
                        </SelectInput>
                        <label className="inventory-date-filter"><span>From</span><TextInput aria-label="Receipts from date" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label>
                        <label className="inventory-date-filter"><span>To</span><TextInput aria-label="Receipts through date" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label>
                        <TextInput aria-label="Filter by delivery reference" placeholder="Delivery reference" value={reference} onChange={(event) => { setReference(event.target.value); setPage(1); }} />
                    </div>
                </div>
                {receiptsQuery.isPending ? (
                    <LoadingState label="Loading goods receipts…" />
                ) : receiptsQuery.isError ? (
                    <ErrorState title="Receipt history could not be loaded" message={getErrorMessage(receiptsQuery.error, 'Check your connection and try again.')} action={<Button onClick={() => void receiptsQuery.refetch()}>Try again</Button>} />
                ) : receipts.length === 0 ? (
                    <EmptyState title="No receipts found" message="Recorded deliveries will appear here." />
                ) : (
                    <>
                        <div className="table-scroll">
                            <table className="product-table">
                                <thead><tr><th>Receipt</th><th>Purchase order</th><th>Supplier</th><th>Received</th><th>Delivery reference</th><th>Lines</th></tr></thead>
                                <tbody>{receipts.map((receipt) => (
                                    <tr key={receipt.id}>
                                        <td><Link to={`/goods-receipts/${receipt.id}`}>{receipt.receipt_number}</Link></td>
                                        <td>{receipt.purchase_order?.order_number ?? 'Legacy receipt'}</td>
                                        <td>{receipt.supplier?.name ?? 'Supplier unavailable'}</td>
                                        <td>{receipt.received_at?.slice(0, 10) ?? '—'}</td>
                                        <td>{receipt.delivery_reference || '—'}</td>
                                        <td>{receipt.items_count ?? '—'}</td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                        <nav className="pagination" aria-label="Goods receipt pages">
                            <span className="pagination__summary">{receiptsQuery.data?.total ?? 0} receipts · Page {page} of {receiptsQuery.data?.last_page ?? 1}</span>
                            <div className="pagination__controls">
                                <Button size="small" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
                                <Button size="small" variant="secondary" disabled={page >= (receiptsQuery.data?.last_page ?? 1)} onClick={() => setPage((value) => value + 1)}>Next</Button>
                            </div>
                        </nav>
                    </>
                )}
            </Card>
        </>
    );
}
