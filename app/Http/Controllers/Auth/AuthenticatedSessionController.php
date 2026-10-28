<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class AuthenticatedSessionController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $throttleKey = Str::lower($credentials['email']).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            return response()->json([
                'message' => 'Too many login attempts. Please try again shortly.',
                'retry_after' => RateLimiter::availableIn($throttleKey),
            ], 429);
        }

        if (! Auth::guard('web')->attempt([
            ...$credentials,
            'is_active' => true,
        ])) {
            RateLimiter::hit($throttleKey, 60);

            return response()->json([
                'message' => 'The provided credentials are incorrect.',
                'errors' => [
                    'email' => ['The provided credentials are incorrect.'],
                ],
            ], 422);
        }

        $request->session()->regenerate();
        RateLimiter::clear($throttleKey);

        return response()->json([
            'user' => $this->userData($request),
        ]);
    }

    public function destroy(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(null, 204);
    }

    public function user(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $this->userData($request),
        ]);
    }

    private function userData(Request $request): array
    {
        $user = $request->user()->loadMissing('role.permissions');
        $roleIsActive = $user->role?->is_active ?? false;

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role ? [
                'id' => $user->role->id,
                'name' => $user->role->name,
                'slug' => $user->role->slug,
            ] : null,
            'permissions' => $roleIsActive
                ? $user->role->permissions->where('is_active', true)->pluck('slug')->values()->all()
                : [],
            'is_active' => $user->is_active,
        ];
    }
}
