<?php

namespace App\Http\Controllers\Api;

use App\Models\Supplier;
use Illuminate\Database\Eloquent\Model;

class SupplierController extends ApiResourceController
{
    protected function modelClass(): string
    {
        return Supplier::class;
    }

    protected function relations(): array
    {
        return ['purchaseReceipts'];
    }

    protected function rules(?Model $model = null): array
    {
        return [
            'name' => $this->requiredOnCreate($model, 'string|max:255'),
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:255',
            'address' => 'nullable|string',
            'is_active' => $this->optionalOnUpdate($model, 'boolean'),
        ];
    }
}
