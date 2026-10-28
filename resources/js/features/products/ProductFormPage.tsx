import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { getErrorMessage, getValidationErrors } from '../../api/client';
import { Button, Card, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { getCategories, getProduct, createProduct, updateProduct } from './api';
import { ProductForm } from './ProductForm';
import type { ProductPayload } from './types';
import { useState } from 'react';

export function ProductFormPage({ mode }: { mode: 'create' | 'edit' }) {
    const { id } = useParams();
    const productId = Number(id);
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [serverErrors, setServerErrors] = useState<Record<string, string[]>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const invalidProductId = mode === 'edit' && (!Number.isInteger(productId) || productId < 1);

    const categoriesQuery = useQuery({
        queryKey: ['categories', { per_page: 100 }],
        queryFn: getCategories,
    });
    const productQuery = useQuery({
        queryKey: ['product', productId],
        queryFn: () => getProduct(productId),
        enabled: mode === 'edit' && !invalidProductId,
    });

    const mutation = useMutation({
        mutationFn: (payload: ProductPayload) => mode === 'create'
            ? createProduct(payload)
            : updateProduct(productId, payload),
        onSuccess: async (product) => {
            await queryClient.invalidateQueries({ queryKey: ['products'] });
            await queryClient.invalidateQueries({ queryKey: ['product', product.id] });
            navigate('/products', {
                replace: true,
                state: { notice: mode === 'create' ? 'Product created successfully.' : 'Product changes saved.' },
            });
        },
        onError: (error: unknown) => {
            setServerErrors(getValidationErrors(error));
            setFormError(getErrorMessage(error, 'We could not save this product. Please try again.'));
        },
    });

    function submit(payload: ProductPayload) {
        setServerErrors({});
        setFormError(null);
        mutation.mutate(payload);
    }

    if (invalidProductId) {
        return <ErrorState title="Invalid product" message="The product identifier is not valid." />;
    }

    if (categoriesQuery.isPending || (mode === 'edit' && productQuery.isPending)) {
        return <LoadingState label={mode === 'create' ? 'Loading categories…' : 'Loading product…'} />;
    }

    if (categoriesQuery.isError) {
        return (
            <ErrorState
                title="Categories could not be loaded"
                message={getErrorMessage(categoriesQuery.error, 'Try again in a moment.')}
                action={<Button onClick={() => void categoriesQuery.refetch()}>Try again</Button>}
            />
        );
    }

    if (mode === 'edit' && productQuery.isError) {
        return (
            <ErrorState
                title="Product could not be loaded"
                message={getErrorMessage(productQuery.error, 'Try again in a moment.')}
                action={<Button onClick={() => void productQuery.refetch()}>Try again</Button>}
            />
        );
    }

    if (mode === 'create' && categoriesQuery.data?.data.length === 0) {
        return (
            <ErrorState
                title="No categories available"
                message="Products need a category. Add a category before creating a product."
            />
        );
    }

    return (
        <>
            <nav className="breadcrumbs" aria-label="Breadcrumb">
                <button type="button" onClick={() => navigate('/products')}>Products</button>
                <span aria-hidden="true">/</span>
                <span>{mode === 'create' ? 'Add product' : 'Edit product'}</span>
            </nav>
            <PageHeader
                title={mode === 'create' ? 'Add a product' : 'Edit product'}
                description={mode === 'create'
                    ? 'Add a product to your catalog and set its stock details.'
                    : 'Update the product information used by your team.'}
            />
            <Card className="form-card">
                <div className="form-card__heading">
                    <h2>Product information</h2>
                    <p>Fields marked as required must be completed before saving.</p>
                </div>
                <ProductForm
                    categories={categoriesQuery.data?.data ?? []}
                    formError={formError}
                    initialProduct={productQuery.data}
                    isSubmitting={mutation.isPending}
                    onCancel={() => navigate('/products')}
                    onSubmit={submit}
                    serverErrors={serverErrors}
                    submitLabel={mode === 'create' ? 'Create product' : 'Save changes'}
                />
            </Card>
        </>
    );
}
