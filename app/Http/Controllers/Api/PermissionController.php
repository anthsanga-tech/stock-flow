<?php

namespace App\Http\Controllers\Api;

use App\Models\Permission;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

class PermissionController extends ApiResourceController
{
    protected function modelClass(): string
    {
        return Permission::class;
    }

    protected function relations(): array
    {
        return ['roles'];
    }

    protected function rules(?Model $model = null): array
    {
        return [
            'name' => $this->requiredOnCreate($model, 'string|max:255'),
            'slug' => [...$this->requiredOnCreate($model, 'string|max:255'), Rule::unique('permissions', 'slug')->ignore($model?->getKey())],
            'is_active' => $this->optionalOnUpdate($model, 'boolean'),
        ];
    }
}
