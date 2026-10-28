<?php

namespace App\Http\Controllers\Api;

use App\Models\OrderStatusHistory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class OrderStatusHistoryController extends ApiResourceController
{
    protected function modelClass(): string
    {
        return OrderStatusHistory::class;
    }

    protected function relations(): array
    {
        return ['order', 'changer'];
    }

    protected function rules(?Model $model = null): array
    {
        return [
            'order_id' => $this->requiredOnCreate($model, 'integer|exists:orders,id'),
            'from_status' => 'nullable|string|max:255',
            'to_status' => $this->requiredOnCreate($model, 'string|max:255'),
            'note' => 'nullable|string',
        ];
    }

    protected function prepareForWrite(array $data, ?Model $model = null): array
    {
        $data['changed_by'] = Auth::id();
        $data['created_at'] = now();

        return $data;
    }
}
