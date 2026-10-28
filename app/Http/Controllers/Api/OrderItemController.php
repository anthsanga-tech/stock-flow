<?php

namespace App\Http\Controllers\Api;

use App\Models\OrderItem;
use Illuminate\Database\Eloquent\Model;

class OrderItemController extends ApiResourceController
{
    protected function modelClass(): string
    {
        return OrderItem::class;
    }

    protected function relations(): array
    {
        return ['order', 'product'];
    }

    protected function rules(?Model $model = null): array
    {
        return [
            'order_id' => $this->requiredOnCreate($model, 'integer|exists:orders,id'),
            'product_id' => $this->requiredOnCreate($model, 'integer|exists:products,id'),
            'sku_snapshot' => $this->requiredOnCreate($model, 'string|max:255'),
            'name_snapshot' => $this->requiredOnCreate($model, 'string|max:255'),
            'quantity' => $this->requiredOnCreate($model, 'integer|min:1'),
            'unit_price' => $this->requiredOnCreate($model, 'numeric|min:0'),
            'line_total' => $this->requiredOnCreate($model, 'numeric|min:0'),
        ];
    }
}
