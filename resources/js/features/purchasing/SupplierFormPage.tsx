import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { getErrorMessage, getValidationErrors } from '../../api/client';
import { Button, Card, ErrorState, FormField, LoadingState, PageHeader, TextInput } from '../../components/ui';
import { createSupplier, getSupplier, updateSupplier } from './api';
import type { SupplierPayload } from './types';

const emptyValues: SupplierPayload = {
    supplier_code: '',
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    is_active: true,
};

export function SupplierFormPage({ mode }: { mode: 'create' | 'edit' }) {
    const { id } = useParams();
    const supplierId = Number(id);
    const invalidId = mode === 'edit' && (!Number.isInteger(supplierId) || supplierId < 1);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [values, setValues] = useState<SupplierPayload>(emptyValues);
    const [errors, setErrors] = useState<Record<string, string[]>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const supplierQuery = useQuery({
        queryKey: ['supplier', supplierId],
        queryFn: () => getSupplier(supplierId),
        enabled: mode === 'edit' && !invalidId,
    });

    useEffect(() => {
        if (supplierQuery.data) {
            setValues({
                supplier_code: supplierQuery.data.supplier_code,
                name: supplierQuery.data.name,
                contact_person: supplierQuery.data.contact_person ?? '',
                email: supplierQuery.data.email ?? '',
                phone: supplierQuery.data.phone ?? '',
                address: supplierQuery.data.address ?? '',
                notes: supplierQuery.data.notes ?? '',
                is_active: supplierQuery.data.is_active,
            });
        }
    }, [supplierQuery.data]);

    const mutation = useMutation({
        mutationFn: (payload: SupplierPayload) => mode === 'create'
            ? createSupplier(payload)
            : updateSupplier(supplierId, payload),
        onSuccess: async (supplier) => {
            await queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            await queryClient.invalidateQueries({ queryKey: ['supplier', supplier.id] });
            navigate(`/suppliers/${supplier.id}`, { replace: true });
        },
        onError: (error: unknown) => {
            setErrors(getValidationErrors(error));
            setFormError(getErrorMessage(error, 'The supplier could not be saved. Check the fields and try again.'));
        },
    });

    function updateValue(field: keyof SupplierPayload, value: string | boolean) {
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
            supplier_code: values.supplier_code.trim(),
            name: values.name.trim(),
        });
    }

    if (invalidId) return <ErrorState title="Invalid supplier" message="The supplier identifier is not valid." />;
    if (mode === 'edit' && supplierQuery.isPending) return <LoadingState label="Loading supplier…" />;
    if (mode === 'edit' && supplierQuery.isError) {
        return <ErrorState title="Supplier could not be loaded" message={getErrorMessage(supplierQuery.error, 'Try again in a moment.')} />;
    }

    const field = (name: keyof SupplierPayload) => errors[name]?.[0];

    return (
        <>
            <nav className="breadcrumbs" aria-label="Breadcrumb">
                <button type="button" onClick={() => navigate('/suppliers')}>Suppliers</button>
                <span aria-hidden="true">/</span><span>{mode === 'create' ? 'Add supplier' : 'Edit supplier'}</span>
            </nav>
            <PageHeader title={mode === 'create' ? 'Add a supplier' : 'Edit supplier'} description="Keep supplier contact details and purchasing status up to date." />
            <Card className="form-card">
                <form className="product-form" onSubmit={submit} noValidate>
                    {formError && <div className="form-alert" role="alert">{formError}</div>}
                    <div className="form-grid">
                        <FormField htmlFor="supplier-code" label="Supplier code" error={field('supplier_code')}>
                            <TextInput id="supplier-code" required value={values.supplier_code} hasError={Boolean(field('supplier_code'))} onChange={(event) => updateValue('supplier_code', event.target.value)} />
                        </FormField>
                        <FormField htmlFor="supplier-name" label="Supplier name" error={field('name')}>
                            <TextInput id="supplier-name" required value={values.name} hasError={Boolean(field('name'))} onChange={(event) => updateValue('name', event.target.value)} />
                        </FormField>
                        <FormField htmlFor="supplier-contact" label="Contact person" error={field('contact_person')}>
                            <TextInput id="supplier-contact" value={values.contact_person} hasError={Boolean(field('contact_person'))} onChange={(event) => updateValue('contact_person', event.target.value)} />
                        </FormField>
                        <FormField htmlFor="supplier-email" label="Email" error={field('email')}>
                            <TextInput id="supplier-email" type="email" value={values.email} hasError={Boolean(field('email'))} onChange={(event) => updateValue('email', event.target.value)} />
                        </FormField>
                        <FormField htmlFor="supplier-phone" label="Phone" error={field('phone')}>
                            <TextInput id="supplier-phone" value={values.phone} hasError={Boolean(field('phone'))} onChange={(event) => updateValue('phone', event.target.value)} />
                        </FormField>
                        <FormField htmlFor="supplier-address" label="Address" error={field('address')}>
                            <TextInput id="supplier-address" value={values.address} hasError={Boolean(field('address'))} onChange={(event) => updateValue('address', event.target.value)} />
                        </FormField>
                        <FormField htmlFor="supplier-notes" label="Notes" error={field('notes')}>
                            <textarea id="supplier-notes" className="form-control" rows={4} value={values.notes} onChange={(event) => updateValue('notes', event.target.value)} />
                        </FormField>
                    </div>
                    {mode === 'edit' && (
                        <label className="checkbox-field">
                            <input type="checkbox" checked={values.is_active} onChange={(event) => updateValue('is_active', event.target.checked)} />
                            Supplier is active
                        </label>
                    )}
                    <div className="form-actions">
                        <Button type="button" variant="secondary" onClick={() => navigate('/suppliers')}>Cancel</Button>
                        <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving…' : 'Save supplier'}</Button>
                    </div>
                </form>
            </Card>
        </>
    );
}
