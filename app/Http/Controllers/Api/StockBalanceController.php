<?php

namespace App\Http\Controllers\Api;

use App\Models\StockBalance;

class StockBalanceController extends ApiResourceController
{
    protected function modelClass(): string
    {
        return StockBalance::class;
    }

    protected function relations(): array
    {
        return ['product'];
    }

    protected function rules(?\Illuminate\Database\Eloquent\Model $model = null): array
    {
        return [];
    }
}
