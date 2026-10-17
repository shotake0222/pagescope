/**
 * テーブルの自動作成
 * `npm run db:migrate:remote` を実行し忘れても（または失敗しても）、
 * 最初のアクセス時にテーブルが無ければ migrations/0001_init.sql の内容で作成します。
 * すべて CREATE ... IF NOT EXISTS なので、後からマイグレーションを実行しても問題ありません。
 */
import type { Env } from '../env';
import INIT_SQL from '../../migrations/0001_init.sql';

const REQUIRED_TABLES = ['users', 'sessions', 'watch_targets', 'diff_histories', 'password_resets', 'login_attempts'];

let ready: Promise<void> | null = null;

function splitStatements(sql: string): string[] {
  return sql
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function missingTables(env: Env): Promise<string[]> {
  const { results } = await env.DB.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${REQUIRED_TABLES.map(() => '?').join(',')})`,
  )
    .bind(...REQUIRED_TABLES)
    .all<{ name: string }>();
  const found = new Set(results.map((r) => r.name));
  return REQUIRED_TABLES.filter((t) => !found.has(t));
}

async function create(env: Env): Promise<void> {
  const missing = await missingTables(env);
  if (!missing.length) return;
  console.warn(`[schema] テーブルが見つからないため自動作成します: ${missing.join(', ')}`);
  await env.DB.batch(splitStatements(INIT_SQL).map((s) => env.DB.prepare(s)));
}

/** isolate ごとに 1 回だけ確認する（失敗したら次のリクエストで再試行） */
export function ensureSchema(env: Env): Promise<void> {
  if (!ready) {
    ready = create(env).catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

/** /healthz 用の診断 */
export async function schemaStatus(env: Env): Promise<{ ok: boolean; missing: string[]; error?: string }> {
  try {
    const missing = await missingTables(env);
    return { ok: missing.length === 0, missing };
  } catch (e) {
    return { ok: false, missing: REQUIRED_TABLES, error: (e as Error).message };
  }
}
