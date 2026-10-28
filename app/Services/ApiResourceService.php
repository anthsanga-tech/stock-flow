<?php

namespace App\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class ApiResourceService
{
    /**
     * @param  class-string<Model>  $modelClass
     * @param  list<string>  $relations
     */
    public function paginate(string $modelClass, array $relations = [], int $perPage = 15): LengthAwarePaginator
    {
        return $modelClass::query()
            ->with($relations)
            ->orderByDesc($modelClass::query()->getModel()->getKeyName())
            ->paginate($perPage)
            ->withQueryString();
    }

    /**
     * @param  class-string<Model>  $modelClass
     * @param  list<string>  $relations
     */
    public function find(string $modelClass, int|string $id, array $relations = []): Model
    {
        return $modelClass::query()->with($relations)->findOrFail($id);
    }

    /**
     * @param  class-string<Model>  $modelClass
     * @param  list<string>  $relations
     */
    public function create(string $modelClass, array $data, array $relations = []): Model
    {
        return DB::transaction(
            fn () => $modelClass::query()->create($data)->load($relations)
        );
    }

    /**
     * @param  class-string<Model>  $modelClass
     * @param  list<string>  $relations
     */
    public function update(Model $model, array $data, array $relations = []): Model
    {
        return DB::transaction(function () use ($model, $data, $relations): Model {
            $model->update($data);

            return $model->refresh()->load($relations);
        });
    }

    public function delete(Model $model): void
    {
        DB::transaction(fn () => $model->delete());
    }
}
