<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Trade extends Model
{
    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['id', 'user_id', 'data', 'deleted', 'client_updated_at'];

    protected $casts = [
        'data' => 'array',
        'deleted' => 'boolean',
        'client_updated_at' => 'datetime',
    ];
}
