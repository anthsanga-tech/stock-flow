import {
    forwardRef,
    useEffect,
    useRef,
    type ButtonHTMLAttributes,
    type InputHTMLAttributes,
    type ReactNode,
    type SelectHTMLAttributes,
} from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
    size?: 'default' | 'small';
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
    children,
    className = '',
    size = 'default',
    variant = 'primary',
    ...props
}, ref) {
    return (
        <button ref={ref} className={`button button--${variant} button--${size} ${className}`.trim()} {...props}>
            {children}
        </button>
    );
});

export function Icon({ name, size = 18 }: { name: 'menu' | 'close' | 'search' | 'plus' | 'edit' | 'archive' | 'chevron' | 'arrow-left' | 'logout'; size?: number }) {
    const paths: Record<typeof name, ReactNode> = {
        menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
        close: <><path d="m6 6 12 12M18 6 6 18" /></>,
        search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
        plus: <><path d="M12 5v14M5 12h14" /></>,
        edit: <><path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16z" /></>,
        archive: <><path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6" /></>,
        chevron: <><path d="m7 10 5 5 5-5" /></>,
        'arrow-left': <><path d="m12 19-7-7 7-7M5 12h14" /></>,
        logout: <><path d="M10 17l5-5-5-5M15 12H3M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    };

    return (
        <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {paths[name]}
        </svg>
    );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
    hasError?: boolean;
};

export function TextInput({ className = '', hasError = false, ...props }: TextInputProps) {
    return (
        <input
            {...props}
            className={`form-control ${hasError ? 'form-control--error' : ''} ${className}`.trim()}
            aria-invalid={hasError || props['aria-invalid'] || undefined}
        />
    );
}

export function SelectInput({ className = '', hasError = false, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { hasError?: boolean }) {
    return (
        <select
            {...props}
            className={`form-control form-select ${hasError ? 'form-control--error' : ''} ${className}`.trim()}
            aria-invalid={hasError || props['aria-invalid'] || undefined}
        />
    );
}

export function FormField({
    children,
    error,
    htmlFor,
    label,
    hint,
}: {
    children: ReactNode;
    error?: string;
    htmlFor: string;
    label: string;
    hint?: string;
}) {
    const hintId = hint ? `${htmlFor}-hint` : undefined;
    const errorId = error ? `${htmlFor}-error` : undefined;

    return (
        <div className="form-field">
            <label className="form-label" htmlFor={htmlFor}>{label}</label>
            {children}
            {hint && <p className="form-hint" id={hintId}>{hint}</p>}
            {error && <p className="form-error" id={errorId} role="alert">{error}</p>}
        </div>
    );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
    return <section className={`card ${className}`.trim()}>{children}</section>;
}

export function PageHeader({
    title,
    description,
    actions,
    eyebrow,
}: {
    title: string;
    description?: string;
    actions?: ReactNode;
    eyebrow?: string;
}) {
    return (
        <header className="page-header">
            <div>
                {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
                <h1>{title}</h1>
                {description && <p className="page-description">{description}</p>}
            </div>
            {actions && <div className="page-header__actions">{actions}</div>}
        </header>
    );
}

export function StatusBadge({ active }: { active: boolean }) {
    return (
        <span className={`status-badge ${active ? 'status-badge--success' : 'status-badge--neutral'}`}>
            <span className="status-badge__dot" aria-hidden="true" />
            {active ? 'Active' : 'Archived'}
        </span>
    );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
    return (
        <div className="state-panel" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            <span>{label}</span>
        </div>
    );
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
    return (
        <div className="state-panel state-panel--empty">
            <span className="empty-state__icon" aria-hidden="true">P</span>
            <h2>{title}</h2>
            <p>{message}</p>
            {action}
        </div>
    );
}

export function ErrorState({
    title,
    message,
    action,
}: {
    title: string;
    message: string;
    action?: ReactNode;
}) {
    return (
        <section className="state-panel state-panel--error" role="alert">
            <span className="error-state__icon" aria-hidden="true">!</span>
            <h2>{title}</h2>
            <p>{message}</p>
            {action}
        </section>
    );
}

export function Pagination({
    page,
    lastPage,
    total,
    itemLabel = 'product',
    onPageChange,
}: {
    page: number;
    lastPage: number;
    total: number;
    itemLabel?: string;
    onPageChange: (page: number) => void;
}) {
    const totalLabel = `${total} ${total === 1 ? itemLabel : `${itemLabel}s`}`;

    if (lastPage <= 1) {
        return <div className="pagination__summary">{totalLabel}</div>;
    }

    return (
        <nav className="pagination" aria-label="Product pages">
            <span className="pagination__summary">{totalLabel} · Page {page} of {lastPage}</span>
            <div className="pagination__controls">
                <Button
                    size="small"
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                    aria-label="Previous page"
                >
                    Previous
                </Button>
                <Button
                    size="small"
                    variant="secondary"
                    disabled={page >= lastPage}
                    onClick={() => onPageChange(page + 1)}
                    aria-label="Next page"
                >
                    Next
                </Button>
            </div>
        </nav>
    );
}

export function ConfirmDialog({
    isOpen,
    title,
    message,
    confirmLabel,
    cancelLabel = 'Keep product',
    pendingLabel = 'Archiving…',
    isPending = false,
    onCancel,
    onConfirm,
}: {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
    pendingLabel?: string;
    isPending?: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const dialogRef = useRef<HTMLDivElement>(null);
    const cancelRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        cancelRef.current?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !isPending) {
                onCancel();
            }
            if (event.key === 'Tab' && dialogRef.current) {
                const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled)');
                if (focusable.length < 2) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [isOpen, isPending, onCancel]);

    if (!isOpen) return null;

    return (
        <div
            className="dialog-backdrop"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !isPending) onCancel();
            }}
        >
            <div
                aria-labelledby="confirm-dialog-title"
                aria-modal="true"
                className="confirm-dialog"
                ref={dialogRef}
                role="alertdialog"
            >
                <h2 id="confirm-dialog-title">{title}</h2>
                <p>{message}</p>
                <div className="confirm-dialog__actions">
                    <Button ref={cancelRef} variant="secondary" disabled={isPending} onClick={onCancel}>
                        {cancelLabel}
                    </Button>
                    <Button variant="danger" disabled={isPending} onClick={onConfirm}>
                        {isPending ? pendingLabel : confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}
