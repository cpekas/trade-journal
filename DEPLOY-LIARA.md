# راهنمای لوکال و سرور (Liara)

## ⚡ لوکال در برابر سرور — یک نگاه

| | 💻 لوکال (توسعه) | ☁️ سرور (لیارا) |
|---|---|---|
| **فرانت** | `npm run dev` → پورت ۵۱۷۳ (بیلد لازم نیست) | `liara deploy --app letstrade --platform react` (لیارا خودش بیلد می‌کنه) |
| **آدرس API** | `VITE_API_URL` رو **خالی بذار** (خودش `localhost:8787` می‌شه) | روی اپ ست شده: `https://letstrade-api.liara.run/api` |
| **بک‌اند** | `php artisan serve --port=8787` (نه ۸۰۰۰ = جنگو) | `liara deploy --path server --app letstrade-api --platform laravel` |
| **دیتابیس** | SQLite (`server/.env` + `database/database.sqlite`) | MariaDB (`letstrade-db`)؛ env در پنل |
| **APP_DEBUG** | `true` | `false` |
| **ایمیل** | `MAIL_MAILER=log` (کد تو `storage/logs/laravel.log`) | `log` تا SMTP بذاری |
| **CORS** | خودکار (لوکال‌هاست همیشه مجاز) | با `FRONTEND_URL` قفل شده |
| **متغیرها** | `server/.env` (دیپلوی نمی‌شه) | پنل لیارا / `liara env:set` |

### راه‌اندازی لوکال (دو ترمینال)
```powershell
# ترمینال ۱ — بک‌اند
php artisan serve --port=8787 --working-dir "F:\code\journal\server"   # یا از پوشهٔ server
# ترمینال ۲ — فرانت
cd F:\code\journal ; npm run dev
```
> اگه قبلاً `$env:VITE_API_URL` رو ست کردی، برای کار با بک‌اند لوکال پاکش کن (`Remove-Item Env:\VITE_API_URL`) وگرنه فرانت لوکال به API پروداکشن وصل می‌شه.

---

# دیپلوی روی لیارا (Liara) — ✅ انجام شد

**زنده:**
- 🌐 اپ (PWA): **https://letstrade.liara.run**
- 🔌 API: **https://letstrade-api.liara.run**
- 🗄️ دیتابیس: `letstrade-db` (MariaDB)، دیتابیس `letstrade`

| سرویس | پلتفرم لیارا | اسم اپ |
|---|---|---|
| فرانت (PWA) | **react** (لیارا خودش `npm run build` می‌زنه) | `letstrade` |
| بک‌اند (API) | **laravel** | `letstrade-api` |
| دیتابیس | **MariaDB** | `letstrade-db` |

## فایل‌های دیپلوی در ریپو
- `liara.json` (ریشه) — فرانت، پلتفرم react.
- `.liaraignore` (ریشه) — موقع دیپلوی فرانت از ریشه، `server/`+`node_modules`+`dist` رو حذف می‌کنه.
- `server/liara.json` — بک‌اند laravel (`configCache`, `buildAssets:false`). PHP خودکار از `composer.json` تشخیص داده می‌شه (8.2).
- `server/liara_pre_start.sh` — هر دیپلوی: دیتابیس `letstrade` رو می‌سازه (اگه نباشه) + `php artisan migrate --force`.
- `server/.env.liara.example` — قالب متغیرها.

## ⚠️ نکتهٔ مهم: میرور کامپوزر
ایمیج laravel لیارا یه میرور قدیمی (`mirror-composer.runflare.com`) داره که الان **HTTP 402** می‌ده و باعث timeout بیلد می‌شه. حل شد با:
1. در `server/composer.json` → `repositories`: غیرفعال‌کردن `packagist`/`packagist.org` و افزودن میرور رسمی فعال **`https://package-mirror.liara.ir/repository/composer/`**.
2. بازتولید `composer.lock` با همون میرور (`composer update --no-install`) تا URLهای dist داخل lock به میرور سالم اشاره کنن (composer هنگام install از URLهای داخل lock استفاده می‌کنه).

> اگه دوباره `composer.lock` رو با میرور runflare ساختی، همین خطا برمی‌گرده. همیشه با میرور `package-mirror.liara.ir` بسازش.

## متغیرهای محیطی بک‌اند (ست‌شده در پنل `letstrade-api`)
`APP_ENV=production`, `APP_DEBUG=false`, `APP_KEY=...`, `APP_URL=https://letstrade-api.liara.run`, **`FRONTEND_URL=https://letstrade.liara.run`** (CORS رو قفل می‌کنه)، `DB_CONNECTION=mysql`, `DB_HOST=letstrade-db`, `DB_PORT=3306`, `DB_DATABASE=letstrade`, `DB_USERNAME=root`, `DB_PASSWORD=…`, `DB_CHARSET=utf8mb4`, `DB_COLLATION=utf8mb4_unicode_ci`, `SESSION_DRIVER=cookie`, `CACHE_STORE=database`, `QUEUE_CONNECTION=database`, `MAIL_MAILER=log`.

## بازدیپلوی (بعد از تغییر کد)

**بک‌اند:**
```powershell
liara deploy --path "F:\code\journal\server" --app letstrade-api --platform laravel --no-app-logs
```

**فرانت:** (آدرس API موقع بیلد سوخته می‌شه؛ لیارا متغیر اپ رو سر بیلد تزریق می‌کنه — قبلاً `VITE_API_URL` روی اپ `letstrade` ست شده)
```powershell
liara deploy --app letstrade --platform react --no-app-logs
```
> اگه از پنل پاک شد: `liara env:set "VITE_API_URL=https://letstrade-api.liara.run/api" --app letstrade --force`

## کارهای باقی‌مونده (اختیاری)
- **ایمیل واقعی:** `MAIL_MAILER=smtp` + اطلاعات SMTP در پنل، بعد سوییچ ادمین «نیاز به تأیید ایمیل» رو روشن کن.
- **دامنهٔ سفارشی:** از پنل هر اپ اضافه کن (HTTPS خودکار). بعد `FRONTEND_URL` رو با کاما گسترش بده.
