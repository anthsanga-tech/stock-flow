import { useEffect, useState, type FormEvent } from 'react';
import type { Category, Product, ProductPayload } from './types';
import { Button, FormField, SelectInput, TextInput } from '../../components/ui';

type ProductFormValues = {
    sku: string;
    name: string;
    category_id: string;
    unit: string;
    cost_price: string;
    selling_price: string;
    reorder_level: string;
    initial_stock: string;
    is_active: boolean;
};

const emptyValues: ProductFormValues = {
    sku: '',
    name: '',
    category_id: '',
    unit: 'pcs',
    cost_price: '',
    selling_price: '',
    reorder_level: '0',
    initial_stock: '0',
    is_active: true,
};

function valuesFromProduct(product?: Product): ProductFormValues {
    if (!product) return emptyValues;

    return {
        sku: product.sku,
        name: product.name,
        category_id: String(product.category_id),
        unit: product.unit,
        cost_price: String(product.cost_price),
        selling_price: String(product.selling_price),
        reorder_level: String(product.reorder_level),
        initial_stock: '0',
        is_active: product.is_active,
    };
}

export function ProductForm({
    categories,
    initialProduct,
    isSubmitting,
    serverErrors = {},
    submitLabel,
    formError,
    onCancel,
    onSubmit,
}: {
    categories: Category[];
    initialProduct?: Product;
    isSubmitting: boolean;
    serverErrors?: Record<string, string[]>;
    submitLabel: string;
    formError?: string | null;
    onCancel: () => void;
    onSubmit: (payload: ProductPayload) => void;
}) {
    const [values, setValues] = useState<ProductFormValues>(() => valuesFromProduct(initialProduct));
    const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        setValues(valuesFromProduct(initialProduct));
        setClientErrors({});
    }, [initialProduct]);

    function setValue<Key extends keyof ProductFormValues>(key: Key, value: ProductFormValues[Key]) {
        setValues((current) => ({ ...current, [key]: value }));
        setClientErrors((current) => ({ ...current, [key]: '' }));
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const nextErrors: Record<string, string> = {};
        const costPrice = Number(values.cost_price);
        const sellingPrice = Number(values.selling_price);
        const reorderLevel = Number(values.reorder_level);
        const initialStock = Number(values.initial_stock);

        if (!values.sku.trim()) nextErrors.sku = 'Enter a SKU.';
        if (!values.name.trim()) nextErrors.name = 'Enter a product name.';
        if (!values.category_id) nextErrors.category_id = 'Choose a category.';
        if (!values.unit.trim()) nextErrors.unit = 'Enter a unit.';
        if (values.cost_price === '' || !Number.isFinite(costPrice) || costPrice < 0) {
            nextErrors.cost_price = 'Enter a valid non-negative cost.';
        }
        if (values.selling_price === '' || !Number.isFinite(sellingPrice) || sellingPrice < 0) {
            nextErrors.selling_price = 'Enter a valid non-negative price.';
        }
        if (values.reorder_level === '' || !Number.isInteger(reorderLevel) || reorderLevel < 0) {
            nextErrors.reorder_level = 'Enter a whole number of zero or more.';
        }
        if (!initialProduct && (values.initial_stock === '' || !Number.isSafeInteger(initialStock) || initialStock < 0)) {
            nextErrors.initial_stock = 'Enter a whole number of zero or more.';
        }

        setClientErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        onSubmit({
            sku: values.sku.trim(),
            name: values.name.trim(),
            category_id: Number(values.category_id),
            unit: values.unit.trim(),
            cost_price: costPrice,
            selling_price: sellingPrice,
            reorder_level: reorderLevel,
            is_active: values.is_active,
            ...(!initialProduct ? { initial_stock: initialStock } : {}),
        });
    }

    function fieldError(name: keyof ProductFormValues): string | undefined {
        return clientErrors[name] || serverErrors[name]?.[0];
    }

    return (
        <form className="product-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
            {formError && <div className="form-alert" role="alert">{formError}</div>}

            <div className="form-grid">
                <FormField htmlFor="product-sku" label="SKU" error={fieldError('sku')} hint="A unique stock-keeping code.">
                    <TextInput
                        autoComplete="off"
                        hasError={Boolean(fieldError('sku'))}
                        id="product-sku"
                        maxLength={255}
                        onChange={(event) => setValue('sku', event.target.value)}
                        value={values.sku}
                    />
                </FormField>
                <FormField htmlFor="product-name" label="Product name" error={fieldError('name')}>
                    <TextInput
                        hasError={Boolean(fieldError('name'))}
                        id="product-name"
                        maxLength={255}
                        onChange={(event) => setValue('name', event.target.value)}
                        value={values.name}
                    />
                </FormField>
                <FormField htmlFor="product-category" label="Category" error={fieldError('category_id')}>
                    <SelectInput
                        hasError={Boolean(fieldError('category_id'))}
                        id="product-category"
                        onChange={(event) => setValue('category_id', event.target.value)}
                        value={values.category_id}
                    >
                        <option value="">Select a category</option>
                        {categories.map((category) => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                    </SelectInput>
                </FormField>
                <FormField htmlFor="product-unit" label="Unit" error={fieldError('unit')} hint="For example: pcs, box, or kg.">
                    <TextInput
                        hasError={Boolean(fieldError('unit'))}
                        id="product-unit"
                        maxLength={100}
                        onChange={(event) => setValue('unit', event.target.value)}
                        value={values.unit}
                    />
                </FormField>
                <FormField htmlFor="product-cost" label="Cost price" error={fieldError('cost_price')}>
                    <TextInput
                        hasError={Boolean(fieldError('cost_price'))}
                        id="product-cost"
                        min="0"
                        onChange={(event) => setValue('cost_price', event.target.value)}
                        step="0.01"
                        type="number"
                        value={values.cost_price}
                    />
                </FormField>
                <FormField htmlFor="product-selling" label="Selling price" error={fieldError('selling_price')}>
                    <TextInput
                        hasError={Boolean(fieldError('selling_price'))}
                        id="product-selling"
                        min="0"
                        onChange={(event) => setValue('selling_price', event.target.value)}
                        step="0.01"
                        type="number"
                        value={values.selling_price}
                    />
                </FormField>
                <FormField htmlFor="product-reorder" label="Reorder level" error={fieldError('reorder_level')} hint="Alert threshold for low stock.">
                    <TextInput
                        hasError={Boolean(fieldError('reorder_level'))}
                        id="product-reorder"
                        min="0"
                        onChange={(event) => setValue('reorder_level', event.target.value)}
                        step="1"
                        type="number"
                        value={values.reorder_level}
                    />
                </FormField>
                {!initialProduct && (
                    <FormField htmlFor="product-initial-stock" label="Initial stock" error={fieldError('initial_stock')} hint="Optional opening quantity; positive quantities are recorded in inventory history.">
                        <TextInput
                            hasError={Boolean(fieldError('initial_stock'))}
                            id="product-initial-stock"
                            min="0"
                            onChange={(event) => setValue('initial_stock', event.target.value)}
                            step="1"
                            type="number"
                            value={values.initial_stock}
                        />
                    </FormField>
                )}
                <label className="checkbox-field" htmlFor="product-active">
                    <input
                        checked={values.is_active}
                        id="product-active"
                        onChange={(event) => setValue('is_active', event.target.checked)}
                        type="checkbox"
                    />
                    <span><strong>Active product</strong><small>Available for daily inventory operations.</small></span>
                </label>
            </div>

            <div className="form-actions">
                <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving…' : submitLabel}
                </Button>
            </div>
        </form>
    );
}
