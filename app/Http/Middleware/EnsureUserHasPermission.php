<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasPermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $role = $request->user()?->role;

        abort_unless(
            $role?->is_active && $role->permissions()
                ->where('slug', $permission)
                ->where('is_active', true)
                ->exists(),
            403,
            'You do not have permission to perform this action.'
        );

        return $next($request);
    }
}
