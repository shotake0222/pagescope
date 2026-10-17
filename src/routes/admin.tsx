import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv } from '../env';
import { clientIp, createSession, destroySession, destroyUserSessions, hashPassword, isAdmin, rateLimitHit, rateLimitReset } from '../lib/auth';
import { PLAN_IDS, type PlanId } from '../lib/plans';
import { isValidEmail, randomPassword, safeEqual } from '../lib/util';
import { AdminPage, type AdminUserRow } from '../views/admin';
import { AdminLoginPage } from '../views/auth';
import { deleteScreenshots } from './app';

export const adminRoutes = new Hono<AppEnv>();

const configured = (env: AppEnv['Bindings']) => !!env.ADMIN_USER && !!env.ADMIN_PASSWORD;

async function render(c: Context<AppEnv>, extra: { message?: string; error?: string; generatedPassword?: string } = {}) {
  const [users, stats] = await Promise.all([
    c.env.DB.prepare(
      `SELECT u.id, u.email, u.plan_type, u.admin_memo, u.created_at,
              (SELECT COUNT(*) FROM watch_targets t WHERE t.user_id = u.id) AS target_count,
              (SELECT MAX(h.detected_at) FROM diff_histories h JOIN watch_targets t ON t.id = h.target_id WHERE t.user_id = u.id AND h.is_baseline = 0) AS last_detected_at
       FROM users u ORDER BY u.id DESC`,
    ).all<AdminUserRow>(),
    c.env.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM watch_targets) AS targets,
              (SELECT COUNT(*) FROM diff_histories) AS histories,
              (SELECT COUNT(*) FROM watch_targets WHERE last_error IS NOT NULL) AS errors`,
    ).first<{ targets: number; histories: number; errors: number }>(),
  ]);
  c.header('Cache-Control', 'no-store');
  return c.html(<AdminPage users={users.results} stats={stats ?? { targets: 0, histories: 0, errors: 0 }} {...extra} />);
}

adminRoutes.get('/admin', async (c) => {
  if (!(await isAdmin(c))) return c.html(<AdminLoginPage notConfigured={!configured(c.env)} />);
  return render(c);
});

adminRoutes.post('/admin/login', async (c) => {
  if (!configured(c.env)) return c.html(<AdminLoginPage notConfigured />, 503);
  const key = `admin:ip:${clientIp(c)}`;
  if (await rateLimitHit(c.env, key)) return c.html(<AdminLoginPage error="試行回数が多すぎます。15分後に再度お試しください。" />, 429);
  const body = await c.req.parseBody();
  const okUser = safeEqual(String(body.login_user ?? ''), c.env.ADMIN_USER!);
  const okPass = safeEqual(String(body.login_pass ?? ''), c.env.ADMIN_PASSWORD!);
  if (!okUser || !okPass) return c.html(<AdminLoginPage error="IDまたはパスワードが間違っています。" />, 401);
  await rateLimitReset(c.env, key);
  await createSession(c, 'admin', null);
  return c.redirect('/admin');
});

adminRoutes.use('/admin/*', async (c, next) => {
  if (c.req.path === '/admin/login') return next();
  if (!(await isAdmin(c))) return c.redirect('/admin');
  await next();
});

adminRoutes.post('/admin/logout', async (c) => {
  await destroySession(c, 'admin');
  return c.redirect('/admin');
});

adminRoutes.post('/admin/users', async (c) => {
  const body = await c.req.parseBody();
  const email = String(body.email ?? '').trim().toLowerCase();
  const plan = String(body.plan_type ?? 'free') as PlanId;
  if (!isValidEmail(email) || !PLAN_IDS.includes(plan)) return render(c, { error: '入力内容に不備があります。' });
  const exists = await c.env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first();
  if (exists) return render(c, { error: 'このメールアドレスは既に登録されています。' });
  const pw = randomPassword();
  await c.env.DB.prepare('INSERT INTO users (email, password_hash, plan_type) VALUES (?, ?, ?)').bind(email, await hashPassword(c.env, pw), plan).run();
  return render(c, { message: `新規ユーザー「${email}」を登録しました！`, generatedPassword: pw });
});

adminRoutes.post('/admin/users/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.parseBody();
  const plan = String(body.plan_type ?? '') as PlanId;
  if (!PLAN_IDS.includes(plan)) return render(c, { error: '不正なリクエストです。' });
  await c.env.DB.prepare('UPDATE users SET plan_type = ?, admin_memo = ? WHERE id = ?')
    .bind(plan, String(body.admin_memo ?? '').slice(0, 2000), id)
    .run();
  return render(c, { message: `ユーザーID: ${id} の情報（プラン・メモ）を更新しました。` });
});

adminRoutes.post('/admin/users/:id/reset-password', async (c) => {
  const id = Number(c.req.param('id'));
  const user = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(id).first<{ email: string }>();
  if (!user) return render(c, { error: '対象のユーザーが見つかりません。' });
  const pw = randomPassword();
  await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(c.env, pw), id).run();
  await destroyUserSessions(c.env, id);
  return render(c, { message: `ユーザー「${user.email}」のパスワードをリセットしました！`, generatedPassword: pw });
});

adminRoutes.post('/admin/users/:id/delete', async (c) => {
  const id = Number(c.req.param('id'));
  const { results } = await c.env.DB.prepare(
    `SELECT h.screenshot_key FROM diff_histories h JOIN watch_targets t ON t.id = h.target_id
     WHERE t.user_id = ? AND h.screenshot_key IS NOT NULL`,
  )
    .bind(id)
    .all<{ screenshot_key: string }>();
  // 監視対象・履歴・セッションは ON DELETE CASCADE で削除される
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  if (results.length) c.executionCtx.waitUntil(deleteScreenshots(c.env.SCREENSHOTS, results.map((r) => r.screenshot_key)));
  return render(c, { message: `ユーザーID: ${id} とその関連データを完全に削除しました。` });
});
