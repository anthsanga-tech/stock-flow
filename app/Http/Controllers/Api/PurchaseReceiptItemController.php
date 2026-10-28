<?php

namespace App\Http\Controllers\Api;

use App\Models\PurchaseReceiptItem;
use Illuminate\Database\Eloquent\Model;

class PurchaseReceiptItemController extends ApiResourceController
{
    protected function modelClass(): string
    {
        return PurchaseReceiptItem::class;
    }

    protected function relations(): array
    {
        return ['receipt', 'product'];
    }

    protected function rules(?Model $model = null): array
    {
        return [
            'receipt_id' => $this->requiredOnCreate($model, 'integer|exists:purchase_receipts,id'),
            'product_id' => $this->requiredOnCreate($model, 'integer|exists:products,id'),
            'quantity' => $this->requiredOnCreate($model, 'integer|min:1'),
            'unit_cost' => $this->requiredOnCreate($model, 'numeric|min:0'),
        ];
    }
}
