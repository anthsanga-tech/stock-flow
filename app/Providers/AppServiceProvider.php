<?php

namespace App\Providers;

use App\Models\Order;
use App\Models\PurchaseReceipt;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('login', function (Request $request) {
            $email = (string) $request->input('email', '');

            return Limit::perMinute(5)->by(
                Str::lower($email).'|'.$request->ip()
            );
        });

        Relation::morphMap([
            'order' => Order::class,
            'purchase_receipt' => PurchaseReceipt::class,
        ]);
    }
}
