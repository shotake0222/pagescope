import { Hono } from 'hono';
import type { AppEnv, HistoryRow } from '../env';
import {
  clientIp,
  createSession,
  destroySession,
  destroyUserSessions,
  getSessionUser,
  hashPassword,
  rateLimitHit,
  rateLimitReset,
  verifyPassword,
} from '../lib/auth';
import { sendMail } from '../lib/notify';
import { isValidEmail, nowSec, randomHex, sha256Hex } from '../lib/util';
import { ForgotPage, LoginPage, ResetPage, SignupPage } from '../views/auth';
import { LandingPage } from '../views/landing';
import { MessagePage } from '../views/misc';
import { DEMO_REPORT, SharePage, type ShareReport } from '../views/share';

export const publicRoutes = new Hono<AppEnv>();

const signupAllowed = (env: AppEnv['Bindings']) => env.ALLOW_SIGNUP === 'true';

// ---------------------------------------------------------------------------
// LP
// ---------------------------------------------------------------------------
publicRoutes.get('/', async (c) => {
  const user = await getSessionUser(c);
  return c.html(
    <LandingPage
      appUrl={c.env.APP_URL.replace(/\/$/, '')}
      allowSignup={signupAllowed(c.env)}
      formspreeId={c.env.FORMSPREE_ID}
      loggedIn={!!user}
      sent={c.req.query('sent') === '1'}
    />,
  );
});

// ---------------------------------------------------------------------------
// 共有レポート（ログイン不要）
// ---------------------------------------------------------------------------
publicRoutes.get('/share/:token', async (c) => {
  const token = c.req.param('token');
  const user = await getSessionUser(c);
  if (token === 'demo-token') return c.html(<SharePage r={DEMO_REPORT} demo loggedIn={!!user} />);
  if (!/^[a-f0-9]{16,64}$/i.test(token)) {
    return c.html(<MessagePage title="レポートが見つかりません" body="URLが間違っているか、すでに削除された可能性があります。" />, 404);
  }
  const r = await c.env.DB.prepare(
    `SELECT h.*, t.target_name, t.target_url, t.selector
     FROM diff_histories h JOIN watch_targets t ON t.id = h.target_id
     WHERE h.share_token = ?`,
  )
    .bind(token)
    .first<HistoryRow & ShareReport>();
  if (!r) return c.html(<MessagePage title="レポートが見つかりません" body="URLが間違っているか、すでに削除された可能性があります。" />, 404);
  c.header('X-Robots-Tag', 'noindex');
  return c.html(<SharePage r={r} demo={false} loggedIn={!!user} />);
});

// R2 に保存したスクリーンショット
publicRoutes.get('/screenshots/:key', async (c) => {
  const key = c.req.param('key');
  if (!/^shot_[a-f0-9]{16,64}\.(jpg|jpeg|png|webp)$/i.test(key)) return c.notFound();
  const obj = await c.env.SCREENSHOTS.get(key);
  if (!obj) return c.notFound();
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('ETag', obj.httpEtag);
  return new Response(obj.body, { headers });
});

// ---------------------------------------------------------------------------
// ログイン / ログアウト
// ---------------------------------------------------------------------------
publicRoutes.get('/login', async (c) => {
  if (await getSessionUser(c)) return c.redirect('/dashboard');
  const notice = c.req.query('reset') === '1' ? 'パスワードを変更しました。新しいパスワードでログインしてください。' : undefined;
  return c.html(<LoginPage allowSignup={signupAllowed(c.env)} notice={notice} />);
});

publicRoutes.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const render = (error: string, status: 400 | 429 = 400) =>
    c.html(<LoginPage allowSignup={signupAllowed(c.env)} error={error} email={email} />, status);

  if (!isValidEmail(email) || !password) return render('メールアドレスとパスワードを入力してください。');

  const ipKey = `login:ip:${clientIp(c)}`;
  const mailKey = `login:mail:${email}`;
  if ((await rateLimitHit(c.env, ipKey)) || (await rateLimitHit(c.env, mailKey))) {
    return render('ログイン試行回数が多すぎます。15分ほど時間をおいてから再度お試しください。', 429);
  }

  const user = await c.env.DB.prepare('SELECT id, password_hash FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: number; password_hash: string }>();
  const v = user ? await verifyPassword(password, user.password_hash) : { ok: false, needsRehash: false };
  if (!user || !v.ok) return render('メールアドレスまたはパスワードが間違っています。');

  if (v.needsRehash) {
    await c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(password), user.id).run();
  }
  await rateLimitReset(c.env, mailKey);
  await createSession(c, 'user', user.id);
  return c.redirect('/dashboard');
});

publicRoutes.post('/logout', async (c) => {
  await destroySession(c, 'user');
  return c.redirect('/login');
});

// ---------------------------------------------------------------------------
// 新規登録（ALLOW_SIGNUP=true のときのみ）
// ---------------------------------------------------------------------------
publicRoutes.get('/signup', (c) => {
  if (!signupAllowed(c.env)) return c.redirect('/#contact');
  return c.html(<SignupPage />);
});

publicRoutes.post('/signup', async (c) => {
  if (!signupAllowed(c.env)) return c.redirect('/#contact');
  const body = await c.req.parseBody();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!isValidEmail(email)) return c.html(<SignupPage error="有効なメールアドレスを入力してください。" email={email} />, 400);
  if (password.length < 8) return c.html(<SignupPage error="パスワードは安全のため8文字以上で設定してください。" email={email} />, 400);
  if (await rateLimitHit(c.env, `signup:ip:${clientIp(c)}`)) {
    return c.html(<SignupPage error="短時間に多数の登録が行われました。しばらく経ってからお試しください。" email={email} />, 429);
  }
  const exists = await c.env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first();
  if (exists) return c.html(<SignupPage error="このメールアドレスは既に登録されています。" email={email} />, 400);

  const res = await c.env.DB.prepare("INSERT INTO users (email, password_hash, plan_type) VALUES (?, ?, 'free')")
    .bind(email, await hashPassword(password))
    .run();
  await createSession(c, 'user', Number(res.meta.last_row_id));
  return c.redirect('/dashboard');
});

// ---------------------------------------------------------------------------
// パスワード再設定
// 旧 login.php の「メールアドレスだけで誰でもパスワードを再発行し画面に表示する」機能は
// 第三者がアカウントを乗っ取れるため廃止し、メールリンク方式（または運営によるリセット）に変更しました。
// ---------------------------------------------------------------------------
publicRoutes.get('/forgot', (c) => c.html(<ForgotPage mailEnabled={!!c.env.RESEND_API_KEY} />));

publicRoutes.post('/forgot', async (c) => {
  if (!c.env.RESEND_API_KEY) return c.redirect('/forgot');
  const body = await c.req.parseBody();
  const email = String(body.email ?? '').trim().toLowerCase();
  if (await rateLimitHit(c.env, `forgot:ip:${clientIp(c)}`)) {
    return c.html(<ForgotPage mailEnabled error="リクエストが多すぎます。しばらく経ってからお試しください。" />, 429);
  }
  const user = isValidEmail(email)
    ? await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first<{ id: number }>()
    : null;
  if (user) {
    const token = randomHex(32);
    await c.env.DB.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
      .bind(await sha256Hex(token), user.id, nowSec() + 3600)
      .run();
    const link = `${c.env.APP_URL.replace(/\/$/, '')}/reset?token=${token}`;
    await sendMail(
      c.env,
      email,
      '【PageScope】パスワード再設定のご案内',
      `PageScope をご利用いただきありがとうございます。\n\n以下のリンクから新しいパスワードを設定してください（有効期限：1時間）。\n${link}\n\nお心当たりのない場合は、このメールを破棄してください。\n\nPageScope.online`,
    );
  }
  // 登録有無が分からないよう、常に同じ表示にする
  return c.html(<ForgotPage mailEnabled sent />);
});

async function findReset(env: AppEnv['Bindings'], token: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return env.DB.prepare('SELECT user_id FROM password_resets WHERE token_hash = ? AND expires_at > ?')
    .bind(await sha256Hex(token), nowSec())
    .first<{ user_id: number }>();
}

publicRoutes.get('/reset', async (c) => {
  const token = c.req.query('token') ?? '';
  const row = await findReset(c.env, token);
  return c.html(<ResetPage token={token} invalid={!row} />, row ? 200 : 400);
});

publicRoutes.post('/reset', async (c) => {
  const body = await c.req.parseBody();
  const token = String(body.token ?? '');
  const password = String(body.password ?? '');
  const row = await findReset(c.env, token);
  if (!row) return c.html(<ResetPage token={token} invalid />, 400);
  if (password.length < 8) return c.html(<ResetPage token={token} error="パスワードは8文字以上で入力してください。" />, 400);
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(password), row.user_id),
    c.env.DB.prepare('DELETE FROM password_resets WHERE user_id = ?').bind(row.user_id),
  ]);
  await destroyUserSessions(c.env, row.user_id);
  return c.redirect('/login?reset=1');
});

// ---------------------------------------------------------------------------
// 旧 PHP 版 URL の互換リダイレクト（既に共有されたリンクを壊さないため）
// ---------------------------------------------------------------------------
publicRoutes.get('/index.php', (c) => c.redirect('/', 301));
publicRoutes.get('/login.php', (c) => c.redirect('/login', 301));
publicRoutes.get('/logout.php', (c) => c.redirect('/login', 301));
publicRoutes.get('/dashboard.php', (c) => c.redirect('/dashboard', 301));
publicRoutes.get('/admin.php', (c) => c.redirect('/admin', 301));
publicRoutes.get('/share.php', (c) => {
  const t = c.req.query('token');
  return t ? c.redirect(`/share/${encodeURIComponent(t)}`, 301) : c.redirect('/', 301);
});
publicRoutes.get('/scope.php', (c) => {
  const t = c.req.query('token');
  return c.req.query('mode') === 'share' && t ? c.redirect(`/share/${encodeURIComponent(t)}`, 301) : c.redirect('/', 301);
});
