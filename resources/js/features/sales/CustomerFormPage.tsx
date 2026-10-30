import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { getErrorMessage, getValidationErrors } from '../../api/client';
import { Button, Card, ErrorState, FormField, LoadingState, PageHeader, SelectInput, TextInput } from '../../components/ui';
import { createCustomer, getCustomer, updateCustomer } from './api';
import type { CustomerPayload } from './types';

const blank: CustomerPayload = { name: '', email: '', phone: '', company_name: '', billing_address: '', shipping_address: '', notes: '', status: 'active' };

export function CustomerFormPage({ mode }: { mode: 'create' | 'edit' }) {
    const { id } = useParams();
    const customerId = Number(id);
    const invalidId = mode === 'edit' && (!Number.isInteger(customerId) || customerId < 1);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [values, setValues] = useState<CustomerPayload>(blank);
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const customerQuery = useQuery({ queryKey: ['customer', customerId], queryFn: () => getCustomer(customerId), enabled: mode === 'edit' && !invalidId });

    useEffect(() => {
        if (customerQuery.data) {
            const customer = customerQuery.data;
            setValues({
                name: customer.name,
                email: customer.email ?? '',
                phone: customer.phone ?? '',
                company_name: customer.company_name ?? '',
                billing_address: customer.billing_address ?? customer.address ?? '',
                shipping_address: customer.shipping_address ?? '',
                notes: customer.notes ?? '',
                status: customer.status,
            });
        }
    }, [customerQuery.data]);

    const mutation = useMutation({
        mutationFn: (payload: CustomerPayload) => mode === 'create' ? createCustomer(payload) : updateCustomer(customerId, payload),
        onSuccess: async (customer) => {
            await queryClient.invalidateQueries({ queryKey: ['customers'] });
            await queryClient.invalidateQueries({ queryKey: ['customer', customer.id] });
            navigate(`/customers/${customer.id}`, { replace: true });
        },
        onError: (error: unknown) => {
            setErrors(getValidationErrors(error));
            setFormError(getErrorMessage(error, 'The customer could not be saved. Check the fields and try again.'));
        },
    });

    function setValue(field: keyof CustomerPayload, value: string) {
        setValues((current) => ({ ...current, [field]: value }));
        setErrors((current) => ({ ...current, [field]: [] }));
        setFormError(null);
    }

    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrors({});
        setFormError(null);
        mutation.mutate({
            ...values,
            name: values.name.trim(),
            email: values.email?.trim() || undefined,
            phone: values.phone?.trim() || undefined,
            company_name: values.company_name?.trim() || undefined,
        });
    }

    if (invalidId) return <ErrorState title="Invalid customer" message="The customer identifier is not valid." />;
    if (mode === 'edit' && customerQuery.isPending) return <LoadingState label="Loading customer…" />;
    if (mode === 'edit' && customerQuery.isError) return <ErrorState title="Customer could not be loaded" message={getErrorMessage(customerQuery.error, 'Try again in a moment.')} />;
    const fieldError = (key: keyof CustomerPayload) => errors[key]?.[0];

    return (
        <>
            <nav className="breadcrumbs" aria-label="Breadcrumb"><button type="button" onClick={() => navigate('/customers')}>Customers</button><span aria-hidden="true">/</span><span>{mode === 'create' ? 'Add customer' : 'Edit customer'}</span></nav>
            <PageHeader title={mode === 'create' ? 'Add a customer' : 'Edit customer'} description="Keep customer contact and delivery details up to date." eyebrow="SALES" />
            <Card className="form-card"><form className="product-form" onSubmit={submit} noValidate>
                {formError && <div className="form-alert" role="alert">{formError}</div>}
                <p className="muted-copy">A customer code will be generated automatically when this record is saved.</p>
                <div className="form-grid">
                    <FormField htmlFor="customer-name" label="Customer name" error={fieldError('name')}><TextInput id="customer-name" required value={values.name} hasError={Boolean(fieldError('name'))} onChange={(event) => setValue('name', event.target.value)} /></FormField>
                    <FormField htmlFor="customer-company" label="Company name" error={fieldError('company_name')}><TextInput id="customer-company" value={values.company_name} hasError={Boolean(fieldError('company_name'))} onChange={(event) => setValue('company_name', event.target.value)} /></FormField>
                    <FormField htmlFor="customer-email" label="Email" error={fieldError('email')}><TextInput id="customer-email" type="email" value={values.email} hasError={Boolean(fieldError('email'))} onChange={(event) => setValue('email', event.target.value)} /></FormField>
                    <FormField htmlFor="customer-phone" label="Phone" error={fieldError('phone')}><TextInput id="customer-phone" value={values.phone} hasError={Boolean(fieldError('phone'))} onChange={(event) => setValue('phone', event.target.value)} /></FormField>
                    <FormField htmlFor="customer-billing" label="Billing address" error={fieldError('billing_address')}><textarea id="customer-billing" className="form-control" rows={3} value={values.billing_address} onChange={(event) => setValue('billing_address', event.target.value)} /></FormField>
                    <FormField htmlFor="customer-shipping" label="Shipping address" error={fieldError('shipping_address')}><textarea id="customer-shipping" className="form-control" rows={3} value={values.shipping_address} onChange={(event) => setValue('shipping_address', event.target.value)} /></FormField>
                    <FormField htmlFor="customer-notes" label="Notes" error={fieldError('notes')}><textarea id="customer-notes" className="form-control" rows={3} value={values.notes} onChange={(event) => setValue('notes', event.target.value)} /></FormField>
                    <FormField htmlFor="customer-status" label="Status" error={fieldError('status')}><SelectInput id="customer-status" value={values.status} onChange={(event) => setValue('status', event.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></SelectInput></FormField>
                </div>
                <div className="form-actions"><Button type="button" variant="secondary" onClick={() => navigate('/customers')}>Cancel</Button><Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save customer'}</Button></div>
            </form></Card>
        </>
    );
}
