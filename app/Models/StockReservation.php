<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockReservation extends Model
{
    protected $fillable = [
        'sales_order_id',
        'sales_order_item_id',
        'product_id',
        'reserved_quantity',
        'status',
    ];

    protected $casts = [
        'reserved_quantity' => 'integer',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class, 'sales_order_id');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class, 'sales_order_item_id');
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
