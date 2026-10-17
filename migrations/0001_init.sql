-- PageScope D1 schema (MySQL 版 users / watch_targets / diff_histories を移植)
-- 日時はすべて UNIX 秒（UTC）で保存し、表示時に JST へ変換します。

CREATE TABLE IF NOT EXISTS users (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  email             TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash     TEXT    NOT NULL,
  plan_type         TEXT    NOT NULL DEFAULT 'free',
  admin_memo        TEXT,
  slack_webhook_url TEXT,
  created_at        INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT    PRIMARY KEY,          -- SHA-256(セッショントークン)
  user_id     INTEGER,                      -- 管理者セッションは NULL
  kind        TEXT    NOT NULL,             -- 'user' | 'admin'
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS watch_targets (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL,
  target_url      TEXT    NOT NULL,
  target_name     TEXT    NOT NULL DEFAULT '',
  selector        TEXT    NOT NULL DEFAULT 'body',
  last_content    TEXT,                     -- 前回取得したテキスト（次回の比較元）
  last_hash       TEXT,
  last_checked_at INTEGER,
  last_changed_at INTEGER,
  last_error      TEXT,                     -- 直近の取得エラー（成功時は NULL）
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_targets_user    ON watch_targets(user_id);
CREATE INDEX IF NOT EXISTS idx_targets_checked ON watch_targets(last_checked_at);

CREATE TABLE IF NOT EXISTS diff_histories (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  target_id       INTEGER NOT NULL,
  old_content     TEXT    NOT NULL DEFAULT '',
  new_content     TEXT    NOT NULL DEFAULT '',
  ai_summary      TEXT,
  ai_importance   TEXT,                     -- 'high' | 'medium' | 'low' | 'none'
  ai_tags         TEXT,                     -- JSON 配列
  screenshot_key  TEXT,                     -- R2 オブジェクトキー
  share_token     TEXT    NOT NULL UNIQUE,
  is_baseline     INTEGER NOT NULL DEFAULT 0,
  added_chars     INTEGER NOT NULL DEFAULT 0,
  removed_chars   INTEGER NOT NULL DEFAULT 0,
  detected_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (target_id) REFERENCES watch_targets(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_hist_target ON diff_histories(target_id, detected_at DESC);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash  TEXT    PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ログイン試行のレート制限（総当たり対策）
CREATE TABLE IF NOT EXISTS login_attempts (
  key           TEXT    PRIMARY KEY,
  count         INTEGER NOT NULL DEFAULT 0,
  window_start  INTEGER NOT NULL
);
