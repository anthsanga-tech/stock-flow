import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Button, Icon } from '../components/ui';

const navigation = [
    { label: 'Products', to: '/products', icon: 'P', available: true },
    { label: 'Inventory', to: '/inventory', icon: 'I', available: false },
    { label: 'Suppliers & receiving', to: '/suppliers', icon: 'S', available: false },
    { label: 'Customers', to: '/customers', icon: 'C', available: false },
    { label: 'Orders', to: '/orders', icon: 'O', available: false },
    { label: 'Reports', to: '/reports', icon: 'R', available: false },
    { label: 'Settings & users', to: '/settings', icon: 'U', available: false },
];

export function AppShell({ children }: { children: React.ReactNode }) {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [logoutError, setLogoutError] = useState<string | null>(null);

    const pageTitle = location.pathname.startsWith('/products') ? 'Products' : 'StockFlow';

    async function handleLogout() {
        setLogoutError(null);
        try {
            await logout();
        } catch {
            setLogoutError('Unable to sign out. Please try again.');
        }
    }

    return (
        <div className={`app-shell ${collapsed ? 'app-shell--collapsed' : ''} ${mobileOpen ? 'app-shell--mobile-open' : ''}`}>
            <div className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-hidden="true" />
            <aside className="sidebar" aria-label="Main navigation">
                <div className="sidebar__brand">
                    <NavLink to="/products" className="brand-mark" aria-label="StockFlow home">S</NavLink>
                    {!collapsed && (
                        <NavLink to="/products" className="brand-wordmark">
                            <span>StockFlow</span>
                            <small>Inventory workspace</small>
                        </NavLink>
                    )}
                    <button
                        className="sidebar__close mobile-only"
                        type="button"
                        onClick={() => setMobileOpen(false)}
                        aria-label="Close navigation"
                    >
                        <Icon name="close" />
                    </button>
                </div>

                {!collapsed && <p className="sidebar__section-label">WORKSPACE</p>}
                <nav className="sidebar__nav">
                    {navigation.filter((item) => !item.available || user?.permissions.includes('products.view')).map((item) => item.available ? (
                        <NavLink
                            key={item.label}
                            to={item.to}
                            className={({ isActive }) => `nav-link ${isActive ? 'nav-link--active' : ''}`}
                            onClick={() => setMobileOpen(false)}
                            title={collapsed ? item.label : undefined}
                        >
                            <span className="nav-link__icon" aria-hidden="true">{item.icon}</span>
                            {!collapsed && <span>{item.label}</span>}
                        </NavLink>
                    ) : (
                        <span
                            key={item.label}
                            className="nav-link nav-link--disabled"
                            aria-disabled="true"
                            title={`${item.label} will be available in a later milestone`}
                        >
                            <span className="nav-link__icon" aria-hidden="true">{item.icon}</span>
                            {!collapsed && <><span>{item.label}</span><span className="nav-link__soon">Soon</span></>}
                        </span>
                    ))}
                </nav>

                <div className="sidebar__footer">
                    {!collapsed && (
                        <div className="sidebar-note">
                            <span className="sidebar-note__status" />
                            <span><strong>Workspace ready</strong><small>Product management</small></span>
                        </div>
                    )}
                    <button
                        className="sidebar__collapse"
                        type="button"
                        onClick={() => setCollapsed((value) => !value)}
                        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        aria-expanded={!collapsed}
                    >
                        <span aria-hidden="true">{collapsed ? '›' : '‹'}</span>
                        {!collapsed && <span>Collapse menu</span>}
                    </button>
                </div>
            </aside>

            <div className="app-main">
                <header className="topbar">
                    <div className="topbar__left">
                        <Button
                            className="topbar__menu"
                            variant="quiet"
                            size="small"
                            onClick={() => setMobileOpen(true)}
                            aria-label="Open navigation"
                        >
                            <Icon name="menu" />
                        </Button>
                        <span className="topbar__context">Workspace <span aria-hidden="true">/</span> {pageTitle}</span>
                    </div>
                    <div className="topbar__right">
                        {logoutError && <span className="topbar__error" role="alert">{logoutError}</span>}
                        <div className="user-menu">
                            <button
                                className="user-menu__trigger"
                                type="button"
                                aria-label={`User menu for ${user?.name ?? 'current user'}`}
                                aria-expanded={userMenuOpen}
                                aria-haspopup="menu"
                                onClick={() => setUserMenuOpen((open) => !open)}
                            >
                                <span className="avatar" aria-hidden="true">{user?.name.slice(0, 1).toUpperCase()}</span>
                                <span className="user-menu__identity">
                                    <strong>{user?.name}</strong>
                                    <small>{user?.role?.name ?? 'Team member'}</small>
                                </span>
                                <Icon name="chevron" size={15} />
                            </button>
                            {userMenuOpen && (
                                <div className="user-menu__dropdown" role="menu">
                                    <div className="user-menu__details">
                                        <strong>{user?.name}</strong>
                                        <span>{user?.email}</span>
                                    </div>
                                    <button role="menuitem" type="button" onClick={() => void handleLogout()}>
                                        <Icon name="logout" size={16} /> Sign out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>
                <main className="page-content">{children}</main>
            </div>
        </div>
    );
}
