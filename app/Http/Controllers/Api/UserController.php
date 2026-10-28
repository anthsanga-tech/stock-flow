<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

class UserController extends ApiResourceController
{
    protected function modelClass(): string
    {
        return User::class;
    }

    protected function relations(): array
    {
        return ['role'];
    }

    protected function rules(?Model $model = null): array
    {
        return [
            'name' => $this->requiredOnCreate($model, 'string|max:255'),
            'email' => [...$this->requiredOnCreate($model, 'email|max:255'), Rule::unique('users', 'email')->ignore($model?->getKey())],
            'password' => $model === null ? 'required|string|min:8' : 'sometimes|required|string|min:8',
            'role_id' => 'nullable|exists:roles,id',
            'is_active' => $this->optionalOnUpdate($model, 'boolean'),
        ];
    }
}
