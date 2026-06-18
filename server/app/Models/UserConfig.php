<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserConfig extends Model
{
    protected $primaryKey = 'user_id';
    public $incrementing = false;

    protected $fillable = ['user_id', 'data'];

    protected $casts = [
        'data' => 'array',
    ];
}
