/**
 * パトロールエンジン（旧 patrol.php / cron_crawler.php / scope.php?mode=patrol を統合）
 */
import type { Env, TargetRow } from '../env';
import { computeDiff, isTrivialChange } from './diff';
import { fetchAndExtract, FetchError, normalizeSelector } from './extract';
import { generateInsight } from './gemini';
import { PATROL_INTERVAL_SEC } from './plans';
import { captureScreenshot } from './screenshot';
import { nowSec, randomHex, sha256Hex } from './util';

export type PatrolStatus = 'baseline' | 'changed' | 'unchanged' | 'error' | 'skipped';

export interface PatrolResult {
  targetId: number;
  name: string;
  status: PatrolStatus;
  message: string;
  shareToken?: string;
}

type TargetWithOwner = TargetRow & { plan_type: string | null };

const BASELINE_MESSAGE = '初回データを保存しました。';
const MAX_TEXT_CHARS = 200_000;

async function loadTarget(env: Env, id: number): Promise<TargetWithOwner | null> {
  return env.DB.prepare(
    `SELECT t.*, u.plan_type
     FROM watch_targets t JOIN users u ON u.id = t.user_id WHERE t.id = ?`,
  )
    .bind(id)
    .first<TargetWithOwner>();
}

/**
 * 1件パトロールする。
 * 同じ対象を自動・手動パトロールが同時に処理しないよう、last_checked_at を条件付き UPDATE で確保してから実行します。
 */
export async function patrolTarget(env: Env, t: TargetWithOwner): Promise<PatrolResult> {
  const base = { targetId: t.id, name: t.target_name || t.target_url };
  const now = nowSec();
  const claim = await env.DB.prepare(
    'UPDATE watch_targets SET last_checked_at = ? WHERE id = ? AND last_checked_at IS ?',
  )
    .bind(now, t.id, t.last_checked_at)
    .run();
  if (!claim.meta.changes) return { ...base, status: 'skipped', message: '別のパトロールが処理中です。' };

  const selector = normalizeSelector(t.selector);

  // 1. 取得 & 抽出
  let text: string;
  try {
    const r = await fetchAndExtract(t.target_url, selector);
    if (!r.matched) throw new FetchError(`セレクタ「${selector}」に一致する要素が見つかりませんでした`);
    if (!r.text) throw new FetchError('監視エリアにテキストがありませんでした（JavaScriptで描画されるページの可能性があります）');
    // D1 の 1 値あたりの上限（2MB）に余裕を持たせて切り詰める
    text = r.text.length > MAX_TEXT_CHARS ? r.text.slice(0, MAX_TEXT_CHARS) : r.text;
  } catch (e) {
    const msg = e instanceof FetchError ? e.message : `取得エラー: ${(e as Error).message}`;
    await env.DB.prepare('UPDATE watch_targets SET last_error = ? WHERE id = ?').bind(msg, t.id).run();
    return { ...base, status: 'error', message: msg };
  }

  const hash = await sha256Hex(text);

  // 2. 初回（または旧 PHP 版から移行した直後）
  const isLegacyHash = !!t.last_hash && t.last_hash.length === 32; // 旧版の md5
  if (!t.last_hash || !t.last_content) {
    const token = randomHex(16);
    const shot = await captureScreenshot(env, t.target_url, token);
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO diff_histories (target_id, old_content, new_content, ai_summary, screenshot_key, share_token, is_baseline, detected_at)
         VALUES (?, '', ?, ?, ?, ?, 1, ?)`,
      ).bind(t.id, text, BASELINE_MESSAGE, shot, token, now),
      env.DB.prepare(
        'UPDATE watch_targets SET last_content = ?, last_hash = ?, last_changed_at = ?, last_error = NULL WHERE id = ?',
      ).bind(text, hash, now, t.id),
    ]);
    return { ...base, status: 'baseline', message: '初回データを保存しました。', shareToken: token };
  }

  // 3. 変更なし
  if (hash === t.last_hash) {
    await env.DB.prepare('UPDATE watch_targets SET last_error = NULL WHERE id = ?').bind(t.id).run();
    return { ...base, status: 'unchanged', message: '変更はありませんでした。' };
  }

  // 4. 空白・記号だけの変化、または旧版ハッシュからの切り替え → 静かに基準を更新
  if (isLegacyHash || isTrivialChange(t.last_content, text)) {
    await env.DB.prepare('UPDATE watch_targets SET last_content = ?, last_hash = ?, last_error = NULL WHERE id = ?')
      .bind(text, hash, t.id)
      .run();
    return { ...base, status: 'unchanged', message: '意味のある変更はありませんでした。' };
  }

  // 5. 差分あり → AI 分析とスクリーンショットを並行実行
  const before = t.last_content;
  const diff = computeDiff(before, text);
  const token = randomHex(16);
  const [insight, shot] = await Promise.all([
    generateInsight(env, { targetName: t.target_name, url: t.target_url, diffExcerpt: diff.excerpt, before, after: text }),
    captureScreenshot(env, t.target_url, token),
  ]);

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO diff_histories
         (target_id, old_content, new_content, ai_summary, ai_importance, ai_tags, screenshot_key, share_token, is_baseline, added_chars, removed_chars, detected_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    ).bind(
      t.id,
      before,
      text,
      insight.summary,
      insight.importance,
      JSON.stringify(insight.tags),
      shot,
      token,
      diff.added,
      diff.removed,
      now,
    ),
    env.DB.prepare(
      'UPDATE watch_targets SET last_content = ?, last_hash = ?, last_changed_at = ?, last_error = NULL WHERE id = ?',
    ).bind(text, hash, now, t.id),
  ]);


  return { ...base, status: 'changed', message: '差分を検知し、レポートを作成しました。', shareToken: token };
}

/** ダッシュボードの「即時パトロール」から 1 件実行（所有者チェック付き） */
export async function patrolOwnTarget(env: Env, userId: number, targetId: number, cooldownSec: number): Promise<PatrolResult> {
  const t = await loadTarget(env, targetId);
  if (!t || t.user_id !== userId) return { targetId, name: '', status: 'error', message: '監視対象が見つかりません。' };
  if (t.last_checked_at && nowSec() - t.last_checked_at < cooldownSec) {
    return { targetId, name: t.target_name, status: 'skipped', message: `直前にチェック済みです（${cooldownSec}秒後から再実行できます）。` };
  }
  return patrolTarget(env, t);
}

async function runWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/** Cron から呼ばれる自動パトロール。プランごとの間隔を過ぎた対象だけを処理する */
export async function runScheduledPatrol(env: Env): Promise<PatrolResult[]> {
  const now = nowSec();
  const { results } = await env.DB.prepare(
    `SELECT t.*, u.plan_type
     FROM watch_targets t JOIN users u ON u.id = t.user_id
     ORDER BY (t.last_checked_at IS NOT NULL), t.last_checked_at ASC`,
  ).all<TargetWithOwner>();

  const due = results.filter((t) => !t.last_checked_at || now - t.last_checked_at >= PATROL_INTERVAL_SEC - 30);
  const batch = due.slice(0, Math.max(1, Number(env.PATROL_BATCH_SIZE) || 15));
  const out: PatrolResult[] = [];

  console.log(`[patrol] 開始: 対象 ${results.length} 件 / 期限到来 ${due.length} 件 / 今回処理 ${batch.length} 件`);
  await runWithConcurrency(batch, 3, async (t) => {
    try {
      const r = await patrolTarget(env, t);
      out.push(r);
      console.log(`[patrol] #${t.id} ${t.target_name}: ${r.status} ${r.message}`);
    } catch (e) {
      console.error(`[patrol] #${t.id} 例外:`, e);
    }
  });

  // 期限切れセッション・古いログイン試行の掃除
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now),
    env.DB.prepare('DELETE FROM password_resets WHERE expires_at < ?').bind(now),
    env.DB.prepare('DELETE FROM login_attempts WHERE window_start < ?').bind(now - 86400),
  ]);
  return out;
}
