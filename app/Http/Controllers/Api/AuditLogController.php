<?php

namespace App\Http\Controllers\Api;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class AuditLogController extends ApiResourceController
{
    protected function modelClass(): string
    {
        return AuditLog::class;
    }

    protected function relations(): array
    {
        return ['user'];
    }

    protected function rules(?Model $model = null): array
    {
        return [
            'action' => $this->requiredOnCreate($model, 'string|max:255'),
            'entity_type' => $this->requiredOnCreate($model, 'string|max:255'),
            'entity_id' => $this->requiredOnCreate($model, 'integer|min:1'),
            'metadata' => 'nullable|array',
        ];
    }

    protected function prepareForWrite(array $data, ?Model $model = null): array
    {
        $data['user_id'] = Auth::id();
        $data['created_at'] = now();

        return $data;
    }
}
