import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { LoginPage } from '../features/auth/LoginPage';
import { ProductFormPage } from '../features/products/ProductFormPage';
import { ProductListPage } from '../features/products/ProductListPage';
import { InventoryPage } from '../features/inventory/InventoryPage';
import { MovementHistoryPage } from '../features/inventory/MovementHistoryPage';
import { StockOperationsPage } from '../features/inventory/StockOperationsPage';
import { SupplierListPage } from '../features/purchasing/SupplierListPage';
import { SupplierFormPage } from '../features/purchasing/SupplierFormPage';
import { SupplierDetailsPage } from '../features/purchasing/SupplierDetailsPage';
import { PurchaseOrderListPage } from '../features/purchasing/PurchaseOrderListPage';
import { PurchaseOrderFormPage } from '../features/purchasing/PurchaseOrderFormPage';
import { PurchaseOrderDetailsPage } from '../features/purchasing/PurchaseOrderDetailsPage';
import { ReceiveGoodsPage } from '../features/purchasing/ReceiveGoodsPage';
import { GoodsReceiptHistoryPage } from '../features/purchasing/GoodsReceiptHistoryPage';
import { GoodsReceiptDetailsPage } from '../features/purchasing/GoodsReceiptDetailsPage';
import { AppShell } from '../layout/AppShell';
import { PermissionRoute, ProtectedRoute } from './ProtectedRoute';
import { ErrorState } from '../components/ui';

function ProtectedShell({ children, permission }: { children: React.ReactNode; permission: string }) {
    return (
        <ProtectedRoute>
            <AppShell>
                <PermissionRoute permission={permission}>{children}</PermissionRoute>
            </AppShell>
        </ProtectedRoute>
    );
}

export function App() {
    const { status } = useAuth();

    if (status === 'error') {
        return (
            <ProtectedRoute>
                <ErrorState title="Unable to continue" message="Your session could not be verified." />
            </ProtectedRoute>
        );
    }

    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Navigate to="/products" replace />} />
            <Route
                path="/products"
                element={
                    <ProtectedShell permission="products.view">
                        <ProductListPage />
                    </ProtectedShell>
                }
            />
            <Route
                path="/products/new"
                element={
                    <ProtectedShell permission="products.manage">
                        <ProductFormPage mode="create" />
                    </ProtectedShell>
                }
            />
            <Route
                path="/products/:id/edit"
                element={
                    <ProtectedShell permission="products.manage">
                        <ProductFormPage mode="edit" />
                    </ProtectedShell>
                }
            />
            <Route
                path="/inventory"
                element={
                    <ProtectedShell permission="products.view">
                        <InventoryPage />
                    </ProtectedShell>
                }
            />
            <Route
                path="/inventory/operations"
                element={
                    <ProtectedShell permission="products.manage">
                        <StockOperationsPage />
                    </ProtectedShell>
                }
            />
            <Route
                path="/inventory/movements"
                element={
                    <ProtectedShell permission="products.view">
                        <MovementHistoryPage />
                    </ProtectedShell>
                }
            />
            <Route
                path="/suppliers"
                element={
                    <ProtectedShell permission="suppliers.view">
                        <SupplierListPage />
                    </ProtectedShell>
                }
            />
            <Route
                path="/suppliers/new"
                element={
                    <ProtectedShell permission="suppliers.manage">
                        <SupplierFormPage mode="create" />
                    </ProtectedShell>
                }
            />
            <Route
                path="/suppliers/:id/edit"
                element={
                    <ProtectedShell permission="suppliers.manage">
                        <SupplierFormPage mode="edit" />
                    </ProtectedShell>
                }
            />
            <Route
                path="/suppliers/:id"
                element={
                    <ProtectedShell permission="suppliers.view">
                        <SupplierDetailsPage />
                    </ProtectedShell>
                }
            />
            <Route
                path="/purchase-orders"
                element={
                    <ProtectedShell permission="suppliers.view">
                        <PurchaseOrderListPage />
                    </ProtectedShell>
                }
            />
            <Route
                path="/purchase-orders/new"
                element={
                    <ProtectedShell permission="suppliers.manage">
                        <PurchaseOrderFormPage mode="create" />
                    </ProtectedShell>
                }
            />
            <Route
                path="/purchase-orders/:id/edit"
                element={
                    <ProtectedShell permission="suppliers.manage">
                        <PurchaseOrderFormPage mode="edit" />
                    </ProtectedShell>
                }
            />
            <Route
                path="/purchase-orders/:id/receive"
                element={
                    <ProtectedShell permission="suppliers.manage">
                        <ReceiveGoodsPage />
                    </ProtectedShell>
                }
            />
            <Route
                path="/purchase-orders/:id"
                element={
                    <ProtectedShell permission="suppliers.view">
                        <PurchaseOrderDetailsPage />
                    </ProtectedShell>
                }
            />
            <Route
                path="/goods-receipts"
                element={
                    <ProtectedShell permission="suppliers.view">
                        <GoodsReceiptHistoryPage />
                    </ProtectedShell>
                }
            />
            <Route
                path="/goods-receipts/:id"
                element={
                    <ProtectedShell permission="suppliers.view">
                        <GoodsReceiptDetailsPage />
                    </ProtectedShell>
                }
            />
            <Route
                path="*"
                element={
                    <ProtectedShell permission="products.view">
                        <ErrorState title="Page not found" message="That page is not available." />
                    </ProtectedShell>
                }
            />
        </Routes>
    );
}
