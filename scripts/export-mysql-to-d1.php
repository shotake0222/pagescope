<?php
/**
 * 旧 PageScope（Xserver / MySQL）のデータを Cloudflare D1 用 SQL に書き出す移行スクリプト
 *
 * 使い方（Xserver に SSH ログインして実行。ブラウザからは実行できません）:
 *
 *   DB_HOST=mysqlXXXX.xserver.jp DB_NAME=xxx DB_USER=xxx DB_PASS='xxx' \
 *     php export-mysql-to-d1.php > pagescope.export.sql
 *
 * 出力された SQL を手元に持ってきて:
 *   npx wrangler d1 execute pagescope --remote --file=pagescope.export.sql
 *
 * ・パスワードは bcrypt のまま移行され、各ユーザーの初回ログイン時に自動で新方式へ切り替わります
 * ・日時は Xserver の MySQL（日本時間）として解釈し、UNIX 秒に変換します
 * ・D1 の「1 文 100KB まで」の上限に収めるため、本文は各 30KB（日本語で約1万文字）までに切り詰めます
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI からのみ実行できます\n");
}

date_default_timezone_set('Asia/Tokyo');
mb_internal_encoding('UTF-8');

$host = getenv('DB_HOST');
$name = getenv('DB_NAME');
$user = getenv('DB_USER');
$pass = getenv('DB_PASS');
if (!$host || !$name || !$user) {
    fwrite(STDERR, "環境変数 DB_HOST / DB_NAME / DB_USER / DB_PASS を指定してください\n");
    exit(1);
}

$pdo = new PDO("mysql:host=$host;dbname=$name;charset=utf8mb4", $user, $pass ?: '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);

const MAX_TEXT_BYTES = 30000; // old_content + new_content + ai_summary が 100KB を超えないように

function q($v): string
{
    if ($v === null) return 'NULL';
    if (is_int($v) || is_float($v)) return (string)$v;
    return "'" . str_replace("'", "''", (string)$v) . "'";
}
function ts($v): string
{
    if (empty($v) || str_starts_with((string)$v, '0000')) return 'NULL';
    $t = strtotime((string)$v);
    return $t ? (string)$t : 'NULL';
}
function txt($v): string
{
    // mb_strcut は UTF-8 の文字境界を壊さずにバイト数で切り詰める
    return q(mb_strcut((string)($v ?? ''), 0, MAX_TEXT_BYTES, 'UTF-8'));
}
function cols(PDO $pdo, string $table): array
{
    return array_column($pdo->query("SHOW COLUMNS FROM `$table`")->fetchAll(), 'Field');
}

$out = fopen('php://stdout', 'w');
fwrite($out, "-- PageScope export " . date('c') . "\n");
fwrite($out, "PRAGMA defer_foreign_keys = true;\n");

// ---- users ----
$uc = cols($pdo, 'users');
$n = 0;
foreach ($pdo->query('SELECT * FROM users ORDER BY id') as $u) {
    if (empty($u['email'])) continue;
    $hash = $u['password_hash'] ?? '';
    // 旧版で平文が入っていたアカウントは移行しない（ログイン不可にし、管理画面からリセットしてもらう）
    if (!preg_match('/^\$2[aby]\$/', $hash)) $hash = '!reset-required';
    // 無料プランは廃止。旧 free は最小のスタートプランとして移行する
    $plan = strtolower(trim($u['plan_type'] ?? $u['plan'] ?? 'start'));
    if (!in_array($plan, ['start', 'light', 'business'], true)) $plan = 'start';
    fwrite($out, sprintf(
        "INSERT OR REPLACE INTO users (id, email, password_hash, plan_type, admin_memo, created_at) VALUES (%d, %s, %s, %s, %s, %s);\n",
        $u['id'],
        q(strtolower(trim($u['email']))),
        q($hash),
        q($plan),
        q(in_array('admin_memo', $uc) ? $u['admin_memo'] : null),
        in_array('created_at', $uc) && ts($u['created_at']) !== 'NULL' ? ts($u['created_at']) : (string)time()
    ));
    $n++;
}
fwrite(STDERR, "users: $n\n");

// ---- diff_histories を先に読み、各ターゲットの最新本文を把握 ----
$hc = cols($pdo, 'diff_histories');
$oldCol = in_array('old_content', $hc) ? 'old_content' : (in_array('before_text', $hc) ? 'before_text' : null);
$newCol = in_array('new_content', $hc) ? 'new_content' : (in_array('after_text', $hc) ? 'after_text' : null);
$latest = [];
$histories = $pdo->query('SELECT * FROM diff_histories ORDER BY detected_at, id')->fetchAll();
foreach ($histories as $h) $latest[$h['target_id']] = $h[$newCol] ?? '';

// ---- watch_targets ----
$tc = cols($pdo, 'watch_targets');
$n = 0;
foreach ($pdo->query('SELECT * FROM watch_targets ORDER BY id') as $t) {
    $last = in_array('last_content', $tc) && !empty($t['last_content']) ? strip_tags($t['last_content']) : ($latest[$t['id']] ?? null);
    fwrite($out, sprintf(
        "INSERT OR REPLACE INTO watch_targets (id, user_id, target_url, target_name, selector, last_content, last_hash, last_checked_at, last_changed_at, created_at) VALUES (%d, %d, %s, %s, %s, %s, %s, %s, %s, %s);\n",
        $t['id'],
        $t['user_id'],
        q($t['target_url']),
        q($t['target_name'] ?? ''),
        q(($t['selector'] ?? '') ?: 'body'),
        $last === null ? 'NULL' : txt($last),
        // 旧 md5 ハッシュを残す → 移行後の初回パトロールで誤検知せず静かに新方式へ切り替わる
        q($last === null ? null : ($t['last_hash'] ?? null)),
        ts($t['last_checked_at'] ?? null),
        ts($t['last_changed_at'] ?? null),
        in_array('created_at', $tc) && ts($t['created_at']) !== 'NULL' ? ts($t['created_at']) : (string)time()
    ));
    $n++;
}
fwrite(STDERR, "watch_targets: $n\n");

// ---- diff_histories ----
$n = 0;
foreach ($histories as $h) {
    $old = $oldCol ? (string)($h[$oldCol] ?? '') : '';
    $summary = $h['ai_summary'] ?? null;
    $baseline = (trim($old) === '' || $summary === '初回データを保存しました。') ? 1 : 0;
    $shot = !empty($h['screenshot_path']) ? basename($h['screenshot_path']) : null;
    $token = $h['share_token'] ?? bin2hex(random_bytes(16));
    fwrite($out, sprintf(
        "INSERT OR REPLACE INTO diff_histories (id, target_id, old_content, new_content, ai_summary, screenshot_key, share_token, is_baseline, detected_at) VALUES (%d, %d, %s, %s, %s, %s, %s, %d, %s);\n",
        $h['id'],
        $h['target_id'],
        txt(strip_tags($old)),
        txt(strip_tags((string)($h[$newCol] ?? ''))),
        q($summary === null ? null : mb_strcut((string)$summary, 0, 20000, 'UTF-8')),
        q($shot),
        q($token),
        $baseline,
        ts($h['detected_at'] ?? null) === 'NULL' ? (string)time() : ts($h['detected_at'])
    ));
    $n++;
}
fwrite(STDERR, "diff_histories: $n\n");
fwrite(STDERR, "完了。出力された SQL を wrangler d1 execute で取り込んでください。\n");
