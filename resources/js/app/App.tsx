import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { LoginPage } from '../features/auth/LoginPage';
import { ProductFormPage } from '../features/products/ProductFormPage';
import { ProductListPage } from '../features/products/ProductListPage';
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
