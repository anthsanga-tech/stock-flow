<?php

namespace App\Http\Controllers\Api;

use App\Models\Role;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

class RoleController extends ApiResourceController
{
    protected function modelClass(): string
    {
        return Role::class;
    }

    protected function relations(): array
    {
        return ['permissions'];
    }

    protected function rules(?Model $model = null): array
    {
        return [
            'name' => $this->requiredOnCreate($model, 'string|max:255'),
            'slug' => [...$this->requiredOnCreate($model, 'string|max:255'), Rule::unique('roles', 'slug')->ignore($model?->getKey())],
            'is_active' => $this->optionalOnUpdate($model, 'boolean'),
        ];
    }
}
