import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { getErrorMessage, getValidationErrors } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { Button, FormField, TextInput } from '../../components/ui';

export function LoginPage() {
    const { login, status, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (status === 'authenticated' && user) {
        return <Navigate to="/products" replace />;
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrors({});
        setFormError(null);

        if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setErrors({ email: ['Enter a valid email address.'] });
            return;
        }
        if (!password) {
            setErrors({ password: ['Enter your password.'] });
            return;
        }

        setIsSubmitting(true);
        try {
            await login(email.trim(), password);
            const from = (location.state as { from?: string } | null)?.from ?? '/products';
            navigate(from, { replace: true });
        } catch (error) {
            setErrors(getValidationErrors(error));
            setFormError(getErrorMessage(error, 'We could not sign you in. Check your details and try again.'));
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <main className="login-page">
            <section className="login-card">
                <div className="login-brand">
                    <span className="brand-mark">S</span>
                    <span>StockFlow</span>
                </div>
                <p className="login-eyebrow">INVENTORY WORKSPACE</p>
                <h1>Welcome back</h1>
                <p className="login-subtitle">Sign in to manage your products and stock.</p>

                {formError && <div className="form-alert" role="alert">{formError}</div>}
                <form className="login-form" onSubmit={handleSubmit} noValidate>
                    <FormField htmlFor="email" label="Work email" error={errors.email?.[0]}>
                        <TextInput
                            autoComplete="username"
                            hasError={Boolean(errors.email)}
                            id="email"
                            name="email"
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="you@company.com"
                            type="email"
                            value={email}
                        />
                    </FormField>
                    <FormField htmlFor="password" label="Password" error={errors.password?.[0]}>
                        <TextInput
                            autoComplete="current-password"
                            hasError={Boolean(errors.password)}
                            id="password"
                            name="password"
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Enter your password"
                            type="password"
                            value={password}
                        />
                    </FormField>
                    <Button className="login-submit" type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Signing in…' : 'Sign in'}
                    </Button>
                </form>
                <p className="login-footer">Secure access for your team. Contact your administrator if you need an account.</p>
            </section>
        </main>
    );
}
