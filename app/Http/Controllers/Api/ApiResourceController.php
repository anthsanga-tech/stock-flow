<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ApiResourceService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

abstract class ApiResourceController extends Controller
{
    abstract protected function modelClass(): string;

    abstract protected function rules(?Model $model = null): array;

    protected function relations(): array
    {
        return [];
    }

    protected function prepareForWrite(array $data, ?Model $model = null): array
    {
        return $data;
    }

    public function index(Request $request, ApiResourceService $service): JsonResponse
    {
        $filters = $request->validate([
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
        ]);

        return response()->json(
            $service->paginate($this->modelClass(), $this->relations(), $filters['per_page'] ?? 15)
        );
    }

    public function store(Request $request, ApiResourceService $service): JsonResponse
    {
        $data = $request->validate($this->rules());
        $model = $service->create(
            $this->modelClass(),
            $this->prepareForWrite($data),
            $this->relations()
        );

        return response()->json($model, 201);
    }

    public function show(int $id, ApiResourceService $service): JsonResponse
    {
        return response()->json($service->find($this->modelClass(), $id, $this->relations()));
    }

    public function update(Request $request, int $id, ApiResourceService $service): JsonResponse
    {
        $model = $this->modelClass()::query()->findOrFail($id);
        $data = $request->validate($this->rules($model));
        $model = $service->update($model, $this->prepareForWrite($data, $model), $this->relations());

        return response()->json($model);
    }

    public function destroy(int $id, ApiResourceService $service): JsonResponse
    {
        $service->delete($this->modelClass()::query()->findOrFail($id));

        return response()->json(null, 204);
    }

    protected function requiredOnCreate(?Model $model, string $rule): array
    {
        return [
            ...($model === null ? ['required'] : ['sometimes', 'required']),
            ...explode('|', $rule),
        ];
    }

    protected function optionalOnUpdate(?Model $model, string $rule): array
    {
        return [
            ...($model === null ? ['nullable'] : ['sometimes', 'nullable']),
            ...explode('|', $rule),
        ];
    }
}
