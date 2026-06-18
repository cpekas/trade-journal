<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use Illuminate\Http\Request;

class AdminController extends Controller
{
    private function ensureAdmin(Request $request): void
    {
        if (! $request->user()->is_admin) {
            abort(403, 'فقط ادمین.');
        }
    }

    public function show(Request $request)
    {
        $this->ensureAdmin($request);

        return response()->json([
            'require_email_verification' => AppSetting::requireEmailVerification(),
        ]);
    }

    public function update(Request $request)
    {
        $this->ensureAdmin($request);

        $data = $request->validate([
            'require_email_verification' => ['required', 'boolean'],
        ]);

        AppSetting::put('require_email_verification', $data['require_email_verification'] ? '1' : '0');

        return response()->json(['require_email_verification' => $data['require_email_verification']]);
    }
}
