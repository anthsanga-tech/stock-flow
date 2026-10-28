<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## StockFlow API

The React SPA uses Laravel Sanctum's first-party, session-cookie authentication. It does not issue bearer tokens or use JWT. Login/logout are `POST /login` and `POST /logout`; `GET /api/user` returns the authenticated user's safe profile, role, and permission slugs. Product and category endpoints require the corresponding `products.view` or `products.manage` permission in addition to an active authenticated session.

### Local development

1. Install PHP and JavaScript dependencies:

   ```powershell
   composer install
   npm install
   ```

2. Configure `.env` for the local database and app URL. The committed `.env.example` defaults to SQLite; for MySQL, set `DB_CONNECTION=mysql`, host, database, username, and password to your local values. Set `APP_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, and `SANCTUM_STATEFUL_DOMAINS` for the URLs you will actually use.

   For the default Vite setup, use `localhost` for both the Laravel and Vite hosts (ports may differ). Do not mix `localhost` and `127.0.0.1`: session cookies are host-only. If you change hosts or ports, include the frontend origin in `CORS_ALLOWED_ORIGINS` and the frontend host and port in `SANCTUM_STATEFUL_DOMAINS`.

3. Create an application key if this is a new local install:

   ```powershell
   php artisan key:generate
   ```

4. Review pending migrations and back up any database with existing data before applying them. Then run `php artisan migrate`; do not use `migrate:fresh` on a database containing data you need.

5. Start Laravel and Vite in separate terminals:

   ```powershell
   php artisan serve
   ```

   ```powershell
   npm run dev
   ```

   Open the Laravel app at `http://localhost:8000`. The SPA requests the API from the current origin by default; `VITE_API_BASE_URL` is only needed when deliberately using a separate API origin.

### Checks

```powershell
php artisan test
npm test
npm run typecheck
npm run build
```

The API also provides full resource endpoints for users, roles, permissions, suppliers, customers, purchase receipts and items, orders and items. Inventory movements, order status history, and audit logs support listing, viewing, and creating records only. Stock balances are read-only. Role permissions can be synchronized with `PUT /api/roles/{role}/permissions` using a `permission_ids` array. List endpoints are paginated (15 records per page) by default.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework.

You may also try the [Laravel Bootcamp](https://bootcamp.laravel.com), where you will be guided through building a modern Laravel application from scratch.

If you don't feel like reading, [Laracasts](https://laracasts.com) can help. Laracasts contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

## Laravel Sponsors

We would like to extend our thanks to the following sponsors for funding Laravel development. If you are interested in becoming a sponsor, please visit the [Laravel Partners program](https://partners.laravel.com).

### Premium Partners

- **[Vehikl](https://vehikl.com/)**
- **[Tighten Co.](https://tighten.co)**
- **[WebReinvent](https://webreinvent.com/)**
- **[Kirschbaum Development Group](https://kirschbaumdevelopment.com)**
- **[64 Robots](https://64robots.com)**
- **[Curotec](https://www.curotec.com/services/technologies/laravel/)**
- **[Cyber-Duck](https://cyber-duck.co.uk)**
- **[DevSquad](https://devsquad.com/hire-laravel-developers)**
- **[Jump24](https://jump24.co.uk)**
- **[Redberry](https://redberry.international/laravel/)**
- **[Active Logic](https://activelogic.com)**
- **[byte5](https://byte5.de)**
- **[OP.GG](https://op.gg)**

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).
