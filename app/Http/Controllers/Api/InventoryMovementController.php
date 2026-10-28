<?php

namespace App\Http\Controllers\Api;

use App\Models\InventoryMovement;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class InventoryMovementController extends ApiResourceController
{
    protected function modelClass(): string
    {
        return InventoryMovement::class;
    }

    protected function relations(): array
    {
        return ['product', 'creator', 'reference'];
    }

    protected function rules(?Model $model = null): array
    {
        return [
            'product_id' => $this->requiredOnCreate($model, 'integer|exists:products,id'),
            'movement_type' => $this->requiredOnCreate($model, 'in:inbound,outbound,adjustment'),
            'quantity_delta' => $this->requiredOnCreate($model, 'integer|not_in:0'),
            'reference_type' => 'nullable|string|max:255',
            'reference_id' => 'nullable|integer|min:1',
            'reason' => 'nullable|string',
        ];
    }

    protected function prepareForWrite(array $data, ?Model $model = null): array
    {
        $data['created_by'] = Auth::id();
        $data['created_at'] = now();

        return $data;
    }
}
