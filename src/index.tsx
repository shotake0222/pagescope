/**
 * PageScope.online — Cloudflare Workers 版エントリーポイント
 *   fetch     : Web 画面 / API（Hono）
 *   scheduled : Cron Trigger による自動パトロール
 */
import { Hono } from 'hono';
import type { AppEnv, Env } from './env';
import { sameOriginOnly } from './lib/auth';
import { runScheduledPatrol } from './lib/patrol';
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
app.use('*', sameOriginOnly);

app.route('/', publicRoutes);
app.route('/', appRoutes);
app.route('/', adminRoutes);

app.get('/healthz', (c) => c.json({ ok: true }));

app.notFound((c) => c.html(<MessagePage title="ページが見つかりません" body="URLが間違っているか、ページが移動した可能性があります。" />, 404));
app.onError((err, c) => {
  console.error('[error]', err);
  return c.html(<MessagePage title="エラーが発生しました" body="時間をおいて再度お試しください。解決しない場合は運営までお問い合わせください。" />, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledPatrol(env));
  },
} satisfies ExportedHandler<Env>;
