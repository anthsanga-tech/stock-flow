import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button, ErrorState, LoadingState } from '../components/ui';

export function PermissionRoute({
    children,
    permission,
}: {
    children: React.ReactNode;
    permission: string;
}) {
    const { user } = useAuth();

    if (!user?.permissions.includes(permission)) {
        return (
            <ErrorState
                title="Access not available"
                message="Your account does not have permission to view this page."
            />
        );
    }

    return children;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { status, error, retry, user } = useAuth();
    const location = useLocation();

    if (status === 'loading') {
        return <LoadingState label="Checking your session…" />;
    }

    if (status === 'error') {
        return (
            <ErrorState
                title="Session check failed"
                message={error ?? 'We could not verify your session.'}
                action={<Button onClick={() => void retry()}>Try again</Button>}
            />
        );
    }

    if (!user) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    return children;
}
