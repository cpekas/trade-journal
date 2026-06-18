<?php

namespace App\Http\Controllers;

use App\Models\UserConfig;
use Illuminate\Http\Request;

class ConfigController extends Controller
{
    public function show(Request $request)
    {
        $cfg = UserConfig::find($request->user()->id);

        return response()->json($cfg ? $cfg->data : null);
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'config' => ['required', 'array'],
        ]);

        $cfg = UserConfig::updateOrCreate(
            ['user_id' => $request->user()->id],
            ['data' => $data['config']]
        );

        return response()->json($cfg->data);
    }
}
