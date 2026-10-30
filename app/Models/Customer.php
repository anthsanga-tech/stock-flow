<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'customer_code',
        'name',
        'email',
        'phone',
        'address',
        'company_name',
        'billing_address',
        'shipping_address',
        'notes',
        'status',
        'is_active',
        'created_at',
        'updated_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    protected $appends = ['status'];

    public function getStatusAttribute(): string
    {
        return (bool) ($this->attributes['is_active'] ?? true) ? 'active' : 'inactive';
    }

    public function setStatusAttribute(string $status): void
    {
        $this->attributes['status'] = $status;
        $this->attributes['is_active'] = $status === 'active';
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
