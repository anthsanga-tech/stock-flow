import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProductForm } from './ProductForm';

const categories = [
    { id: 7, name: 'Components', slug: 'components', is_active: true },
];

describe('ProductForm', () => {
    it('shows client validation and does not submit invalid values', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();

        render(
            <ProductForm
                categories={categories}
                isSubmitting={false}
                onCancel={vi.fn()}
                onSubmit={onSubmit}
                submitLabel="Create product"
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Create product' }));

        expect(screen.getByText('Enter a SKU.')).toBeInTheDocument();
        expect(screen.getByText('Choose a category.')).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('submits trimmed text and numeric values', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();

        render(
            <ProductForm
                categories={categories}
                isSubmitting={false}
                onCancel={vi.fn()}
                onSubmit={onSubmit}
                submitLabel="Create product"
            />,
        );

        await user.type(screen.getByLabelText('SKU'), ' PART-01 ');
        await user.type(screen.getByLabelText('Product name'), ' Small part ');
        await user.selectOptions(screen.getByLabelText('Category'), '7');
        await user.clear(screen.getByLabelText('Unit'));
        await user.type(screen.getByLabelText('Unit'), 'pcs');
        await user.type(screen.getByLabelText('Cost price'), '2.5');
        await user.type(screen.getByLabelText('Selling price'), '4.75');
        await user.clear(screen.getByLabelText('Reorder level'));
        await user.type(screen.getByLabelText('Reorder level'), '12');
        await user.click(screen.getByRole('button', { name: 'Create product' }));

        expect(onSubmit).toHaveBeenCalledWith({
            sku: 'PART-01',
            name: 'Small part',
            category_id: 7,
            unit: 'pcs',
            cost_price: 2.5,
            selling_price: 4.75,
            reorder_level: 12,
            is_active: true,
        });
    });

    it('displays field-level validation errors returned by the API', () => {
        render(
            <ProductForm
                categories={categories}
                isSubmitting={false}
                onCancel={vi.fn()}
                onSubmit={vi.fn()}
                serverErrors={{ sku: ['The SKU has already been taken.'] }}
                submitLabel="Save changes"
            />,
        );

        expect(screen.getByText('The SKU has already been taken.')).toBeInTheDocument();
        expect(screen.getByLabelText('SKU')).toHaveAttribute('aria-invalid', 'true');
    });
});
