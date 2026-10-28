import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getErrorMessage, getValidationErrors } from '../../api/client';
import { Button, Card, ErrorState, FormField, LoadingState, PageHeader, SelectInput, TextInput } from '../../components/ui';
import { getInventory } from './api';
import { createMovement } from './api';
import type { InventoryFilters, MovementType } from './types';

export function StockOperationsPage() {
    const queryClient = useQueryClient();
    const [productId, setProductId] = useState('');
    const [movementType, setMovementType] = useState<MovementType>('inbound');
    const [adjustmentDirection, setAdjustmentDirection] = useState<'increase' | 'decrease'>('increase');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
    const [formError, setFormError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const productFilters: InventoryFilters = {
        status: 'all',
        sort_by: 'name',
        sort_direction: 'asc',
        page: 1,
        per_page: 100,
    };
    const productsQuery = useQuery({
        queryKey: ['inventory', 'operation-products'],
        queryFn: () => getInventory(productFilters),
    });
    const products = productsQuery.data?.data ?? [];
    const product = products.find((item) => String(item.id) === productId);
    const parsedQuantity = Number(quantity);
    const quantityIsValid = Number.isSafeInteger(parsedQuantity) && parsedQuantity > 0;
    const quantityDelta = useMemo(() => {
        if (!quantityIsValid) return 0;
        if (movementType === 'outbound' || (movementType === 'adjustment' && adjustmentDirection === 'decrease')) {
            return -parsedQuantity;
        }
        return parsedQuantity;
    }, [adjustmentDirection, movementType, parsedQuantity, quantityIsValid]);
    const resultingBalance = (product?.quantity_on_hand ?? 0) + quantityDelta;

    const mutation = useMutation({
        mutationFn: createMovement,
        onSuccess: async (movement) => {
            setNotice(`Stock updated. New balance: ${movement.quantity_after} ${movement.product.unit}.`);
            setFieldErrors({});
            setFormError(null);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['inventory'] }),
                queryClient.invalidateQueries({ queryKey: ['inventory-movements'] }),
                queryClient.invalidateQueries({ queryKey: ['stock-balances'] }),
            ]);
        },
        onError: (error: unknown) => {
            setFieldErrors(getValidationErrors(error));
            setFormError(getErrorMessage(error, 'The stock movement could not be saved. Check the details and try again.'));
        },
    });

    const canSubmit = Boolean(
        product
        && quantityIsValid
        && resultingBalance >= 0
        && (movementType !== 'adjustment' || reason.trim())
        && !mutation.isPending,
    );

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setFieldErrors({});
        setFormError(null);
        setNotice(null);

        if (!product || !quantityIsValid) {
            setFieldErrors({ quantity_delta: ['Choose a product and enter a whole quantity greater than zero.'] });
            return;
        }
        if (resultingBalance < 0) {
            setFieldErrors({ quantity_delta: ['This issue would reduce available stock below zero.'] });
            return;
        }
        if (movementType === 'adjustment' && !reason.trim()) {
            setFieldErrors({ reason: ['Enter a reason for this adjustment.'] });
            return;
        }

        mutation.mutate({
            product_id: product.id,
            movement_type: movementType,
            quantity_delta: quantityDelta,
            ...(reason.trim() ? { reason: reason.trim() } : {}),
        });
    }

    return (
        <>
            <PageHeader
                title="Record stock movement"
                description="Receive stock, issue stock, or correct a balance with an auditable reason."
                eyebrow="INVENTORY"
                actions={<Link className="button button--secondary" to="/inventory">Back to inventory</Link>}
            />

            {notice && (
                <div className="notice notice--success" role="status">
                    <span aria-hidden="true">✓</span>{notice}
                    <Link to={`/inventory/movements${product ? `?product_id=${product.id}` : ''}`}>View history</Link>
                    <button type="button" aria-label="Dismiss notification" onClick={() => setNotice(null)}>×</button>
                </div>
            )}
            {formError && <div className="notice notice--error" role="alert">{formError}</div>}

            {productsQuery.isPending ? (
                <Card><LoadingState label="Loading active products…" /></Card>
            ) : productsQuery.isError ? (
                <ErrorState
                    title="Products could not be loaded"
                    message={getErrorMessage(productsQuery.error, 'Check your connection and try again.')}
                    action={<Button onClick={() => void productsQuery.refetch()}>Try again</Button>}
                />
            ) : (
                <Card className="inventory-operation-card">
                    <form className="inventory-operation-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
                        <div className="inventory-operation-form__heading">
                            <h2>Movement details</h2>
                            <p>Every completed movement updates stock and creates a permanent history record.</p>
                        </div>

                        <div className="form-grid">
                            <FormField htmlFor="inventory-product" label="Product" error={fieldErrors.product_id?.[0]}>
                                <SelectInput
                                    id="inventory-product"
                                    hasError={Boolean(fieldErrors.product_id)}
                                    onChange={(event) => setProductId(event.target.value)}
                                    value={productId}
                                >
                                    <option value="">Select an active product</option>
                                    {products.map((item) => (
                                        <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>
                                    ))}
                                </SelectInput>
                            </FormField>
                            <FormField htmlFor="movement-type" label="Movement type">
                                <SelectInput
                                    id="movement-type"
                                    onChange={(event) => setMovementType(event.target.value as MovementType)}
                                    value={movementType}
                                >
                                    <option value="inbound">Receive stock</option>
                                    <option value="outbound">Issue stock</option>
                                    <option value="adjustment">Manual adjustment</option>
                                </SelectInput>
                            </FormField>
                            {movementType === 'adjustment' && (
                                <FormField htmlFor="adjustment-direction" label="Adjustment direction">
                                    <SelectInput
                                        id="adjustment-direction"
                                        onChange={(event) => setAdjustmentDirection(event.target.value as 'increase' | 'decrease')}
                                        value={adjustmentDirection}
                                    >
                                        <option value="increase">Increase stock</option>
                                        <option value="decrease">Decrease stock</option>
                                    </SelectInput>
                                </FormField>
                            )}
                            <FormField
                                htmlFor="movement-quantity"
                                label={`Quantity${product ? ` (${product.unit})` : ''}`}
                                error={fieldErrors.quantity_delta?.[0]}
                                hint={movementType === 'adjustment' ? 'Enter a positive whole number. Select increase or decrease above.' : 'Enter a positive whole number.'}
                            >
                                <TextInput
                                    id="movement-quantity"
                                    aria-label="Quantity"
                                    hasError={Boolean(fieldErrors.quantity_delta)}
                                    inputMode="numeric"
                                    min="1"
                                    onChange={(event) => setQuantity(event.target.value)}
                                    step="1"
                                    type="number"
                                    value={quantity}
                                />
                            </FormField>
                            <div className="inventory-balance-preview" aria-live="polite">
                                <span>Current balance</span>
                                <strong>{product ? `${product.quantity_on_hand} ${product.unit}` : 'Select a product'}</strong>
                                {product && quantityIsValid && (
                                    <p>
                                        {quantityDelta > 0 ? '+' : '−'}{Math.abs(quantityDelta)} {product.unit}
                                        <span aria-hidden="true"> → </span>
                                        <strong className={resultingBalance < 0 ? 'inventory-preview--invalid' : ''}>
                                            {resultingBalance} {product.unit}
                                        </strong>
                                    </p>
                                )}
                                {product && resultingBalance < 0 && <small className="form-error">Available stock cannot become negative.</small>}
                            </div>
                            <FormField
                                htmlFor="movement-reason"
                                label={movementType === 'adjustment' ? 'Reason (required)' : 'Reason (optional)'}
                                error={fieldErrors.reason?.[0]}
                                hint="This note is saved with the movement for later review."
                            >
                                <TextInput
                                    id="movement-reason"
                                    hasError={Boolean(fieldErrors.reason)}
                                    maxLength={1000}
                                    onChange={(event) => setReason(event.target.value)}
                                    placeholder={movementType === 'adjustment' ? 'Explain why the stock is being corrected' : 'Add context for this movement'}
                                    value={reason}
                                />
                            </FormField>
                        </div>

                        <div className="inventory-operation-form__actions">
                            <Link className="button button--secondary" to="/inventory">Cancel</Link>
                            <Button disabled={!canSubmit} type="submit">
                                {mutation.isPending ? 'Saving movement…' : 'Confirm movement'}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}
        </>
    );
}
