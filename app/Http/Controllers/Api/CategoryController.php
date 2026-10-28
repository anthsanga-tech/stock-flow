<?php

namespace App\Http\Controllers\Api;

use App\Models\Category;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\Rule;

class CategoryController extends ApiResourceController
{
    protected function modelClass(): string
    {
        return Category::class;
    }

    protected function relations(): array
    {
        return ['products'];
    }

    protected function rules(?Model $model = null): array
    {
        return [
            'name' => $this->requiredOnCreate($model, 'string|max:255'),
            'slug' => [...$this->requiredOnCreate($model, 'string|max:255'), Rule::unique('categories', 'slug')->ignore($model?->getKey())],
            'is_active' => $this->optionalOnUpdate($model, 'boolean'),
        ];
    }
}
