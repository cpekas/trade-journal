# ژورنال معامله — بک‌اند (Laravel)

API احراز هویت + سنک برای PWA ژورنال. توکن‌محور (Sanctum)، دیتای هر کاربر جدا.

## اجرا (لوکال)

```bash
php artisan serve --port=8787
```

> پورت ۸۰۰۰ روی این دستگاه دست یه اپ Django دیگه‌ست؛ برای همین ۸۷۸۷.

دیتابیس پیش‌فرض **SQLite** است (`database/database.sqlite`). مهاجرت‌ها قبلاً اجرا شدن. برای ریست:

```bash
php artisan migrate:fresh
```

## اتصال فرانت

فرانت به‌صورت پیش‌فرض `http://localhost:8787/api` رو صدا می‌زنه. برای تغییر، در ریشهٔ پروژهٔ فرانت یه `.env` بساز:

```
VITE_API_URL=https://api.your-domain.com/api
```

## Endpoints

| متد | مسیر | کار |
|-----|------|-----|
| POST | `/api/register` | ثبت‌نام → `{user, token}` |
| POST | `/api/login` | ورود → `{user, token}` |
| POST | `/api/logout` | ابطال توکن (نیاز به توکن) |
| GET | `/api/user` | کاربر فعلی |
| POST | `/api/sync` | دلتا‌سینک معاملات (`{lastPulledAt, changes}` → `{trades, serverTime}`) |
| GET/PUT | `/api/config` | کانفیگ کاربر (نماد/ستاپ/سشن/تایم‌فریم/اهرم/چک‌لیست) |

همهٔ مسیرهای محافظت‌شده هدر `Authorization: Bearer <token>` می‌خوان.

## دیپلوی روی سرور خودت

1. کل پوشهٔ `server/` رو بذار روی سرور (PHP 8.2+، Composer).
2. `composer install --no-dev --optimize-autoloader`
3. `.env` رو بساز (از `.env.example`)، `php artisan key:generate`.
4. دیتابیس: برای پروداکشن **MySQL** پیشنهاد می‌شه — در `.env`:
   ```
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_DATABASE=journal
   DB_USERNAME=...
   DB_PASSWORD=...
   ```
   بعد `php artisan migrate`.
5. وب‌سرور (Nginx/Apache) رو به `server/public` اشاره بده، روی **HTTPS**.
6. در `config/cors.php` مقدار `allowed_origins` رو از `*` به دامنهٔ PWA خودت محدود کن.
7. کش: `php artisan config:cache && php artisan route:cache`.
