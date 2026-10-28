<?php

namespace App\Http\Controllers\Api;

use App\Models\PurchaseReceipt;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class PurchaseReceiptController extends ApiResourceController
{
    protected function modelClass(): string
    {
        return PurchaseReceipt::class;
    }

    protected function relations(): array
    {
        return ['supplier', 'creator', 'items'];
    }

    protected function rules(?Model $model = null): array
    {
        return [
            'supplier_id' => $this->requiredOnCreate($model, 'integer|exists:suppliers,id'),
            'receipt_number' => [...$this->requiredOnCreate($model, 'string|max:255'), Rule::unique('purchase_receipts', 'receipt_number')->ignore($model?->getKey())],
            'status' => $this->optionalOnUpdate($model, 'in:pending,received,cancelled'),
            'received_at' => 'nullable|date',
        ];
    }

    protected function prepareForWrite(array $data, ?Model $model = null): array
    {
        $data['created_by'] = Auth::id();

        return $data;
    }
}
