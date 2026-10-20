/**
 * PageScope — Cloudflare Workers 版エントリーポイント
 *   fetch     : Web 画面 / API（Hono）
 *   scheduled : Cron Trigger による自動パトロール
 */
import { Hono } from 'hono';
import type { AppEnv, Env } from './env';
import { hashIterations, sameOriginOnly } from './lib/auth';
import { runScheduledPatrol } from './lib/patrol';
import { ensureSchema, schemaStatus } from './lib/schema';
import { randomHex } from './lib/util';
import { adminRoutes } from './routes/admin';
import { appRoutes } from './routes/app';
import { publicRoutes } from './routes/public';
import { MessagePage } from './views/misc';

const app = new Hono<AppEnv>();

// セキュリティヘッダー
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('X-Frame-Options', 'DENY');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
});

// 稼働確認（テーブルの有無・必須設定の登録状況。値そのものは返さない）
app.get('/healthz', async (c) => {
  const db = await schemaStatus(c.env);
  return c.json(
    {
      ok: db.ok,
      database: db.ok ? 'ok' : db.error ? `接続エラー: ${db.error}` : `テーブル未作成: ${db.missing.join(', ')}`,
      admin_configured: !!c.env.ADMIN_USER && !!c.env.ADMIN_PASSWORD,
      gemini_configured: !!c.env.GEMINI_API_KEY,
      password_hash_iterations: hashIterations(c.env),
    },
    db.ok ? 200 : 503,
  );
});

// テーブルが無ければ自動作成（マイグレーションの実行漏れ対策）
app.use('*', async (c, next) => {
  await ensureSchema(c.env);
  await next();
});
app.use('*', sameOriginOnly);

app.route('/', publicRoutes);
app.route('/', appRoutes);
app.route('/', adminRoutes);

app.notFound((c) => c.html(<MessagePage title="ページが見つかりません" body="URLが間違っているか、ページが移動した可能性があります。" />, 404));
app.onError((err, c) => {
  // `npx wrangler tail` やダッシュボードのログで、この ID から原因を探せます
  const id = randomHex(4);
  console.error(`[error ${id}] ${c.req.method} ${new URL(c.req.url).pathname}:`, err);
  return c.html(
    <MessagePage
      title="エラーが発生しました"
      body={`時間をおいて再度お試しください。解決しない場合は運営までお問い合わせください。（エラーID: ${id}）`}
    />,
    500,
  );
});

export default {
  // 本番（静的アセット併用時）は fetch が必ず Promise を返す必要があるため async で包む
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(ensureSchema(env).then(() => runScheduledPatrol(env)));
  },
} satisfies ExportedHandler<Env>;
