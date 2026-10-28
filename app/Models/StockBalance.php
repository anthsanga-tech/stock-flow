<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockBalance extends Model
{
    use HasFactory;

    protected $primaryKey = 'product_id';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'product_id',
        'quantity_on_hand',
        'updated_at',
    ];

    protected $casts = [
        'product_id' => 'integer',
        'quantity_on_hand' => 'integer',
        'updated_at' => 'datetime',
    ];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
