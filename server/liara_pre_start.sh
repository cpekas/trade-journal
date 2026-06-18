#!/usr/bin/env sh
# Runs in the Liara container before the app starts, on every deploy/restart.
# 1) Ensure the target database exists (root can CREATE; no-op if it already does).
# 2) Apply pending migrations (idempotent — safe to re-run).
php -r '
$h=getenv("DB_HOST"); $p=getenv("DB_PORT")?:"3306";
$u=getenv("DB_USERNAME"); $pw=getenv("DB_PASSWORD"); $db=getenv("DB_DATABASE");
if(!$db){ fwrite(STDERR, "DB_DATABASE not set\n"); exit(0); }
try {
  $pdo=new PDO("mysql:host=$h;port=$p", $u, $pw, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
  $name=str_replace("`", "", $db);
  $pdo->exec("CREATE DATABASE IF NOT EXISTS `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  echo "database ensured: $db\n";
} catch (Throwable $e) {
  fwrite(STDERR, "could not ensure database: ".$e->getMessage()."\n");
}
'
php artisan migrate --force
