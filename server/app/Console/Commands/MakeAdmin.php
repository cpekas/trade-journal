<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class MakeAdmin extends Command
{
    protected $signature = 'user:admin {email}';

    protected $description = 'Promote a user to super-admin';

    public function handle(): int
    {
        $user = User::where('email', $this->argument('email'))->first();
        if (! $user) {
            $this->error('کاربری با این ایمیل پیدا نشد.');
            return 1;
        }
        $user->is_admin = true;
        $user->save();
        $this->info($user->email . ' حالا ادمینه.');
        return 0;
    }
}
