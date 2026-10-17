import { Hono } from 'hono';
import type { AppEnv, TargetRow } from '../env';
import { destroyUserSessions, hashPassword, requireUser, createSession, verifyPassword } from '../lib/auth';
import { normalizeSelector, validateSelector } from '../lib/extract';
import { patrolOwnTarget } from '../lib/patrol';
import { getPlan, MANUAL_PATROL_COOLDOWN_SEC } from '../lib/plans';
import { normalizeUrl } from '../lib/util';
import { DashboardPage, type TimelineRow } from '../views/dashboard';
import { SettingsPage } from '../views/settings';

export const appRoutes = new Hono<AppEnv>();
appRoutes.use('/dashboard', requireUser);
appRoutes.use('/dashboard/*', requireUser);
appRoutes.use('/settings', requireUser);
appRoutes.use('/settings/*', requireUser);
appRoutes.use('/api/*', requireUser);

const PER_PAGE = 50;

// ---------------------------------------------------------------------------
// ダッシュボード
// ---------------------------------------------------------------------------
appRoutes.get('/dashboard', async (c) => {
  const user = c.get('user');
  const plan = getPlan(user.plan_type);
  const filterRaw = Number(c.req.query('filter_id'));
  const filterId = Number.isInteger(filterRaw) && filterRaw > 0 ? filterRaw : null;
  const page = Math.max(1, Math.floor(Number(c.req.query('page')) || 1));

  const where = filterId ? 'WHERE t.user_id = ? AND t.id = ?' : 'WHERE t.user_id = ?';
  const params: (number | string)[] = filterId ? [user.id, filterId] : [user.id];

  const [targets, totalAll, totalFiltered, histories] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, user_id, target_url, target_name, selector, last_hash, last_checked_at, last_changed_at, last_error, created_at, NULL AS last_content
       FROM watch_targets WHERE user_id = ? ORDER BY created_at DESC`,
    )
      .bind(user.id)
      .all<TargetRow>(),
    c.env.DB.prepare(
      'SELECT COUNT(*) AS n FROM diff_histories h JOIN watch_targets t ON t.id = h.target_id WHERE t.user_id = ? AND h.is_baseline = 0',
    )
      .bind(user.id)
      .first<{ n: number }>(),
    c.env.DB.prepare(`SELECT COUNT(*) AS n FROM diff_histories h JOIN watch_targets t ON t.id = h.target_id ${where}`)
      .bind(...params)
      .first<{ n: number }>(),
    c.env.DB.prepare(
      `SELECT h.id, h.target_id, h.ai_summary, h.ai_importance, h.ai_tags, h.screenshot_key, h.share_token, h.is_baseline,
              h.added_chars, h.removed_chars, h.detected_at, '' AS old_content, '' AS new_content,
              t.target_name, t.target_url
       FROM diff_histories h JOIN watch_targets t ON t.id = h.target_id
       ${where} ORDER BY h.detected_at DESC, h.id DESC LIMIT ? OFFSET ?`,
    )
      .bind(...params, PER_PAGE, (page - 1) * PER_PAGE)
      .all<TimelineRow>(),
  ]);

  c.header('Cache-Control', 'no-store');
  return c.html(
    <DashboardPage
      email={user.email}
      plan={plan}
      targets={targets.results}
      histories={histories.results}
      totalAlerts={totalAll?.n ?? 0}
      totalHistories={totalFiltered?.n ?? 0}
      page={page}
      perPage={PER_PAGE}
      filterId={filterId}
      flash={c.req.query('msg')}
      appUrl={new URL(c.req.url).origin}
    />,
  );
});

appRoutes.post('/dashboard/targets', async (c) => {
  const user = c.get('user');
  const plan = getPlan(user.plan_type);
  const count = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM watch_targets WHERE user_id = ?').bind(user.id).first<{ n: number }>();
  if ((count?.n ?? 0) >= plan.maxTargets) return c.redirect('/dashboard?msg=limit');

  const body = await c.req.parseBody();
  const url = normalizeUrl(String(body.target_url ?? ''));
  const name = String(body.target_name ?? '').trim().slice(0, 120);
  const selector = normalizeSelector(String(body.selector ?? '').slice(0, 200));
  if (!url) return c.redirect('/dashboard?msg=invalid_url');
  if (!validateSelector(selector)) return c.redirect('/dashboard?msg=invalid_selector');

  try {
    await c.env.DB.prepare('INSERT INTO watch_targets (user_id, target_url, target_name, selector) VALUES (?, ?, ?, ?)')
      .bind(user.id, url, name || new URL(url).hostname, selector)
      .run();
  } catch (e) {
    console.error('insert target', e);
    return c.redirect('/dashboard?msg=insert');
  }
  return c.redirect('/dashboard?msg=registered');
});

appRoutes.post('/dashboard/targets/:id/delete', async (c) => {
  const user = c.get('user');
  const id = Number(c.req.param('id'));
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT h.screenshot_key FROM diff_histories h JOIN watch_targets t ON t.id = h.target_id
       WHERE t.id = ? AND t.user_id = ? AND h.screenshot_key IS NOT NULL`,
    )
      .bind(id, user.id)
      .all<{ screenshot_key: string }>();
    // 履歴は ON DELETE CASCADE で一緒に削除される
    const res = await c.env.DB.prepare('DELETE FROM watch_targets WHERE id = ? AND user_id = ?').bind(id, user.id).run();
    if (res.meta.changes && results.length) {
      c.executionCtx.waitUntil(deleteScreenshots(c.env.SCREENSHOTS, results.map((r) => r.screenshot_key)));
    }
  } catch (e) {
    console.error('delete target', e);
    return c.redirect('/dashboard?msg=delete');
  }
  return c.redirect('/dashboard?msg=deleted');
});

export async function deleteScreenshots(bucket: R2Bucket, keys: string[]) {
  for (let i = 0; i < keys.length; i += 1000) await bucket.delete(keys.slice(i, i + 1000));
}

// 即時パトロール（ダッシュボードから 1 件ずつ呼ばれる）
appRoutes.post('/api/patrol/:id', async (c) => {
  const user = c.get('user');
  const result = await patrolOwnTarget(c.env, user.id, Number(c.req.param('id')), MANUAL_PATROL_COOLDOWN_SEC);
  return c.json(result);
});

// ---------------------------------------------------------------------------
// アカウント設定
// ---------------------------------------------------------------------------
appRoutes.get('/settings', (c) => {
  const user = c.get('user');
  c.header('Cache-Control', 'no-store');
  return c.html(<SettingsPage email={user.email} plan={getPlan(user.plan_type)} flash={c.req.query('msg')} />);
});

appRoutes.post('/settings/password', async (c) => {
  const user = c.get('user');
  const body = await c.req.parseBody();
  const current = String(body.current ?? '');
  const next = String(body.password ?? '');
  if (next.length < 8) return c.redirect('/settings?msg=password_short');
  if (next !== String(body.password2 ?? '')) return c.redirect('/settings?msg=password_mismatch');
  if (!(await verifyPassword(c.env, current, user.password_hash)).ok) return c.redirect('/settings?msg=password_wrong');

  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(c.env, next), user.id).run();
  await destroyUserSessions(c.env, user.id);
  await createSession(c, 'user', user.id); // この端末はログイン状態を維持
  return c.redirect('/settings?msg=password_ok');
});
