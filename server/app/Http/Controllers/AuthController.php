<?php

namespace App\Http\Controllers;

use App\Models\AppSetting;
use App\Models\EmailVerification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6'],
        ]);

        $user = User::create([
            'name' => $data['name'] ?? explode('@', $data['email'])[0],
            'email' => $data['email'],
            'password' => $data['password'],
        ]);

        if (AppSetting::requireEmailVerification()) {
            $this->sendCode($user);
            return response()->json(['needsVerification' => true, 'email' => $user->email], 201);
        }

        return response()->json(['user' => $user, 'token' => $user->createToken('pwa')->plainTextToken], 201);
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $key = 'login:' . Str::lower($data['email']) . '|' . $request->ip();

        if (RateLimiter::tooManyAttempts($key, 5)) {
            $seconds = RateLimiter::availableIn($key);
            throw ValidationException::withMessages([
                'email' => ["تعداد تلاش زیاد شد. $seconds ثانیه دیگه دوباره امتحان کن."],
            ]);
        }

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            RateLimiter::hit($key, 60);
            throw ValidationException::withMessages([
                'email' => ['ایمیل یا رمز عبور اشتباهه.'],
            ]);
        }

        RateLimiter::clear($key);

        if (AppSetting::requireEmailVerification() && ! $user->email_verified_at) {
            $this->sendCode($user);
            return response()->json(['needsVerification' => true, 'email' => $user->email]);
        }

        return response()->json(['user' => $user, 'token' => $user->createToken('pwa')->plainTextToken]);
    }

    public function verifyEmail(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'code' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();
        $rec = $user ? EmailVerification::where('user_id', $user->id)->latest('id')->first() : null;

        if (! $user || ! $rec || $rec->code !== $data['code'] || $rec->expires_at->isPast()) {
            throw ValidationException::withMessages([
                'code' => ['کد اشتباه یا منقضی شده.'],
            ]);
        }

        $user->email_verified_at = now();
        $user->save();
        EmailVerification::where('user_id', $user->id)->delete();

        return response()->json(['user' => $user, 'token' => $user->createToken('pwa')->plainTextToken]);
    }

    public function resendCode(Request $request)
    {
        $data = $request->validate(['email' => ['required', 'email']]);
        $user = User::where('email', $data['email'])->first();
        if ($user && ! $user->email_verified_at) {
            $this->sendCode($user);
        }
        // Don't reveal whether the account exists.
        return response()->json(['ok' => true]);
    }

    public function user(Request $request)
    {
        return response()->json($request->user());
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['ok' => true]);
    }

    private function sendCode(User $user): void
    {
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        EmailVerification::where('user_id', $user->id)->delete();
        EmailVerification::create([
            'user_id' => $user->id,
            'code' => $code,
            'expires_at' => now()->addMinutes(10),
        ]);

        Mail::raw("کد تأیید ژورنال معامله: $code\nاین کد تا ۱۰ دقیقه معتبره.", function ($m) use ($user) {
            $m->to($user->email)->subject('کد تأیید ژورنال معامله');
        });
    }
}
