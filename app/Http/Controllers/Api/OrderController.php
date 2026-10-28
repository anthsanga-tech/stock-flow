<?php

namespace App\Http\Controllers\Api;

use App\Models\Order;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class OrderController extends ApiResourceController
{
    protected function modelClass(): string
    {
        return Order::class;
    }

    protected function relations(): array
    {
        return ['customer', 'creator', 'items', 'statusHistory'];
    }

    protected function rules(?Model $model = null): array
    {
        return [
            'order_number' => [...$this->requiredOnCreate($model, 'string|max:255'), Rule::unique('orders', 'order_number')->ignore($model?->getKey())],
            'customer_id' => $this->requiredOnCreate($model, 'integer|exists:customers,id'),
            'status' => $this->optionalOnUpdate($model, 'in:pending,processing,completed,cancelled'),
            'subtotal' => $this->requiredOnCreate($model, 'numeric|min:0'),
            'discount' => $this->requiredOnCreate($model, 'numeric|min:0'),
            'tax' => $this->requiredOnCreate($model, 'numeric|min:0'),
            'total' => $this->requiredOnCreate($model, 'numeric|min:0'),
        ];
    }

    protected function prepareForWrite(array $data, ?Model $model = null): array
    {
        $data['created_by'] = Auth::id();

        return $data;
    }
}
