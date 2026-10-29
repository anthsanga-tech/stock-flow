# StockFlow

StockFlow is a small-business inventory and order-management application. This repository currently contains the Phase 1 UI foundation and product-management workflow, plus the Phase 2 inventory workflow. It uses Laravel 11 for the JSON API and server-rendered SPA entry point, with React, TypeScript, Vite, and TanStack Query for the client.

## Current capabilities

### Phase 1: UI foundation and product management

- Light-theme design tokens for indigo actions, slate navigation and text, white surfaces, semantic status colors, and responsive breakpoints.
- Responsive application shell with collapsible desktop navigation, a mobile navigation drawer, user menu, and logout action.
- Sanctum session-based login, current-user lookup, active-account checks, permission-aware route guards, and session retry/error states.
- Product catalog with search by name or SKU, category and active/archive filters, sorting, pagination, stock-on-hand display, and archive confirmation.
- Product creation and editing with client-side and server-side field validation.
- Reusable buttons, inputs, select controls, cards, form fields, status badges, pagination, confirmation dialog, loading/empty/error states.

### Phase 2: Inventory management

- Active-product inventory overview with current quantity, reorder level, category, stock status, summary counts, search, filters, sorting, pagination, and links to movement history.
- Stock receipt, issue, and manual-adjustment workflow with current-balance preview, resulting-balance estimate, reason field, server validation, and duplicate-submit protection.
- Newest-first, paginated movement history with filters for product, movement type, actor, and date range.
- Atomic stock balance updates and append-only movement records with before/after quantity snapshots, actor, reason, optional supported reference, and timestamp.
- Per-product low-stock calculation; archived products are excluded from active inventory and alerts.

Products and Inventory are the currently implemented application areas. Suppliers, purchase receiving UI, customers, orders, reports, and settings are not complete user-facing features in these phases, even though related backend models or API resources may exist.

## Technology

- PHP 8.2+
- Laravel 11 and Sanctum 4
- React 19, TypeScript, Vite 6, React Router 7, TanStack Query 5
- MySQL for a typical Laragon deployment; the example environment defaults to SQLite
- PHPUnit for backend tests; Vitest and Testing Library for frontend tests

No additional package installation is required beyond the dependencies in `composer.lock` and `package-lock.json`.

## Local development on Windows / Laragon

1. Install PHP and Node.js, then install project dependencies from the repository root:

   ```powershell
   composer install
   npm install
   ```

2. Create the local environment file if it does not exist and generate an application key:

   ```powershell
   Copy-Item .env.example .env
   php artisan key:generate
   ```

   Configure `.env` for the database connection and URLs you intend to use. `.env.example` uses SQLite by default. For MySQL, set `DB_CONNECTION=mysql` and configure `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, and `DB_PASSWORD` for your Laragon database.

3. Configure the Laravel and Vite hosts consistently. The defaults use Laravel at `http://localhost:8000` and Vite at `http://localhost:5173`. Sanctum session cookies are host-specific: avoid mixing `localhost` and `127.0.0.1`. If you change the development host or port, update `APP_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, and `SANCTUM_STATEFUL_DOMAINS` to match.

   - `APP_URL`: Laravel application origin.
   - `FRONTEND_URL`: Vite origin used by the CORS defaults.
   - `CORS_ALLOWED_ORIGINS`: comma-separated allowed browser origins; credentialed requests are enabled.
   - `SANCTUM_STATEFUL_DOMAINS`: comma-separated frontend/API hostnames, including ports where applicable.
   - `VITE_API_BASE_URL`: optional API origin override. Leave blank when the frontend and API are served from the same origin.

4. Review the pending migrations and make a backup before applying migrations to any database with data you need. Apply migrations with:

   ```powershell
   php artisan migrate
   ```

   Do not use `php artisan migrate:fresh` or `db:wipe` on a development database containing data you need. Phase 2 adds an additive migration for movement balance snapshots and indexes; it does not require existing movement rows to be rewritten.

5. To load the project's seed records, inspect `database/seeders/DatabaseSeeder.php` and the individual seeders first, then run:

   ```powershell
   php artisan db:seed
   ```

   Seeders create or update demo/reference rows. The `PR-1001` receipt lines are seeded before their inbound movements; movements use those line quantities and the transactional inventory service. Repeated inventory seeding does not duplicate movements or overwrite balances. Only seed a database where those records are appropriate.

6. Start the Laravel and Vite development servers in separate PowerShell terminals:

   ```powershell
   php artisan serve
   ```

   ```powershell
   npm run dev
   ```

   Open `http://localhost:8000`. For the SPA session flow, use the same host (`localhost`) for the app and Vite.

## Authentication and authorization

The SPA uses Laravel Sanctum's first-party session-cookie authentication; it does not store bearer tokens. The frontend first requests `/sanctum/csrf-cookie`, then posts credentials to `/login`. Axios sends cookies and the XSRF token with requests. Successful authentication regenerates the session; logout invalidates it and regenerates the CSRF token. Login attempts are rate limited.

Authenticated API routes use `auth:sanctum` and the active-user middleware. Product and inventory reads require the `products.view` permission. Product changes and stock movements require `products.manage`. The React route guards and hidden/disabled navigation are for user experience only; Laravel independently enforces API permissions.

The demo accounts created by the seeders are assigned roles. Admin, manager, and staff roles receive their permissions from `RolePermissionSeeder`; users without an active role and the required permission are intentionally denied access. If an existing database has roles but no permissions, run `php artisan db:seed --class=PermissionSeeder` followed by `php artisan db:seed --class=RolePermissionSeeder`, then sign out and back in to refresh the session's permission list.

## Product API

All `/api` endpoints require an authenticated active session unless stated otherwise. Product list responses use Laravel pagination (15 per page by default, maximum 100).

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/products` | Paginated product list; supports `search`, `category_id`, `is_active`, `sort_by`, `sort_direction`, `page`, and `per_page`. |
| `POST` | `/api/products` | Create a product (`products.manage`). |
| `GET` | `/api/products/{id}` | Retrieve a product with category and stock balance. |
| `PUT` / `PATCH` | `/api/products/{id}` | Update product fields; the UI archives by setting `is_active` to `false`. |
| `DELETE` | `/api/products/{id}` | Delete a product through the API. The application UI uses archive rather than hard deletion. |

Product creation requires `sku`, `name`, `category_id`, `unit`, `cost_price`, `selling_price`, and `reorder_level`. SKU is unique; prices and reorder level must be non-negative. The optional `initial_stock` must be a non-negative integer. Products created without it start with a zero balance and no movement; a positive value creates an inbound opening movement and matching balance atomically. List endpoints return `{ current_page, data, last_page, per_page, total, ... }`.

## Inventory API

The inventory API reuses the existing product, stock-balance, and inventory-movement tables. All routes require an authenticated active user. Reads require `products.view`; creating a movement requires `products.manage`.

| Method | Endpoint | Purpose and filters |
|---|---|---|
| `GET` | `/api/inventory` | Paginated active inventory; supports `search` (SKU/name), `category_id`, `status` (`all`, `in_stock`, `low_stock`, `out_of_stock`), `sort_by`, `sort_direction`, `page`, and `per_page`. Includes `active_products_count` and `low_stock_count`. |
| `GET` | `/api/inventory/low-stock` | Paginated active products at or below their reorder level. |
| `GET` | `/api/stock-balances` | Paginated stock balances. |
| `GET` | `/api/stock-balances/{productId}` | Current balance for a product; a product without a balance row has quantity zero. |
| `GET` | `/api/inventory-movements` | Newest-first movement history; supports `product_id`, `movement_type`, `user_id`, `from`, `to`, `page`, and `per_page`. Dates use `YYYY-MM-DD`. |
| `POST` | `/api/inventory-movements` | Record a receipt, issue, or adjustment. |

Example receipt:

```json
{
  "product_id": 12,
  "movement_type": "inbound",
  "quantity_delta": 25,
  "reason": "Supplier delivery"
}
```

Example issue:

```json
{
  "product_id": 12,
  "movement_type": "outbound",
  "quantity_delta": -4,
  "reason": "Damaged stock"
}
```

Example manual adjustment:

```json
{
  "product_id": 12,
  "movement_type": "adjustment",
  "quantity_delta": -2,
  "reason": "Physical count correction"
}
```

Movement quantities are non-zero signed integers: inbound quantities must be positive, outbound quantities must be negative, and adjustments can be either sign. Adjustments require a reason. The resulting balance cannot be negative. Archived products cannot receive new movements. Supported optional reference types are `order` and `purchase_receipt`; provide `reference_type` and `reference_id` together.

Each successful movement updates the balance and appends a movement in one database transaction. The response includes the resulting product, movement type, signed quantity delta, `quantity_before`, `quantity_after`, reason/reference, creator, and timestamp. Validation errors use Laravel's standard `422` response with field-level `errors`; rejected requests leave both balance and history unchanged. Completed movements are not edited or deleted; correct an entry with a compensating movement.

Low stock means available quantity is less than or equal to that product's `reorder_level`. A quantity of zero is shown as out of stock. A zero reorder level is valid, so zero-quantity products with a zero threshold are low stock. Products without a balance row are treated as zero quantity. Archived products are excluded from the overview counts and low-stock alert.

## UI design and accessibility

The light theme's centralized CSS custom properties live in `resources/css/app.css`: primary indigo (`#4F46E5`), slate sidebar/text, slate page background, white surfaces, slate borders, and semantic success, warning, danger, and information colors. The shell and inventory UI adapt to narrow viewports with a mobile navigation drawer and card layouts. Status text accompanies semantic status colors; visible keyboard focus and reduced-motion handling are included.

Shared controls and states live in `resources/js/components/ui.tsx`. Feature-specific API calls, types, and page behavior are grouped under `resources/js/features/`. `resources/js/api/client.ts` centralizes Axios configuration and validation/error parsing. The app uses TanStack Query for server-state loading and refresh after stock changes.

## Tests and checks

Run the backend and frontend suites and production checks from the repository root:

```powershell
php artisan test
npm test
npm run typecheck
npm run build
php artisan route:list
```

PHPUnit is configured in `phpunit.xml` to force an in-memory SQLite database. Feature tests therefore do not intentionally use the database configured in `.env`. The SQLite test engine validates application behavior and rollback, but it does not simulate concurrent InnoDB row locks; validate locking behavior under concurrency against MySQL before relying on it in production.

## Current limitations

- The dashboard, supplier/receiving, customer, order, reports, and settings experiences are not implemented as complete UI workflows in these phases.
- Inventory history can show before/after snapshots for movements recorded after the Phase 2 migration; older movement rows have `null` snapshots.
- The frontend exposes the stock movement form for users with the manage permission; issue/adjustment policy remains enforced by the API.
- Tests do not provide a multi-connection MySQL concurrency stress test.