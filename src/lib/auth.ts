import type { Context, MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import bcrypt from 'bcryptjs';
import type { AppEnv, Env, UserRow } from '../env';
import { nowSec, randomHex, safeEqual, sha256Hex } from './util';

const enc = new TextEncoder();

// ---------------------------------------------------------------------------
// パスワードハッシュ（PBKDF2-SHA256 / Workers の上限 100,000 回）
// 旧 PHP 版の bcrypt ($2y$...) はログイン時に検証し、成功したら PBKDF2 へ自動移行します。
// ---------------------------------------------------------------------------
const PBKDF2_ITER = 100_000;

function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITER);
  return `pbkdf2$${PBKDF2_ITER}$${b64(salt)}$${b64(hash)}`;
}

/** @returns ok: 一致したか / needsRehash: 旧形式なので再ハッシュすべきか */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (stored.startsWith('pbkdf2$')) {
    const [, iterStr, saltB64, hashB64] = stored.split('$');
    const hash = await pbkdf2(password, unb64(saltB64), Number(iterStr));
    return { ok: safeEqual(b64(hash), hashB64), needsRehash: Number(iterStr) < PBKDF2_ITER };
  }
  if (/^\$2[aby]\$/.test(stored)) {
    // PHP の $2y$ は $2b$ と同一アルゴリズム
    const ok = await bcrypt.compare(password, stored.replace(/^\$2y\$/, '$2b$'));
    return { ok, needsRehash: true };
  }
  // 平文パスワードの照合（旧 login.php にあった抜け道）は廃止しました
  return { ok: false, needsRehash: false };
}

// ---------------------------------------------------------------------------
// セッション（D1 に SHA-256 化したトークンを保存 / Cookie は HttpOnly + Secure）
// ---------------------------------------------------------------------------
export const USER_COOKIE = 'ps_session';
export const ADMIN_COOKIE = 'ps_admin';
const USER_TTL = 60 * 60 * 24 * 30; // 30日
const ADMIN_TTL = 60 * 60 * 12; // 12時間

function cookieOpts(c: Context, maxAge: number) {
  const secure = new URL(c.req.url).protocol === 'https:';
  return { httpOnly: true, secure, sameSite: 'Lax' as const, path: '/', maxAge };
}

export async function createSession(c: Context<AppEnv>, kind: 'user' | 'admin', userId: number | null) {
  const token = randomHex(32);
  const ttl = kind === 'admin' ? ADMIN_TTL : USER_TTL;
  await c.env.DB.prepare('INSERT INTO sessions (id, user_id, kind, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256Hex(token), userId, kind, nowSec() + ttl)
    .run();
  setCookie(c, kind === 'admin' ? ADMIN_COOKIE : USER_COOKIE, token, cookieOpts(c, ttl));
}

export async function destroySession(c: Context<AppEnv>, kind: 'user' | 'admin') {
  const name = kind === 'admin' ? ADMIN_COOKIE : USER_COOKIE;
  const token = getCookie(c, name);
  if (token) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256Hex(token)).run();
  }
  deleteCookie(c, name, { path: '/' });
}

/** ユーザーの全セッションを無効化（パスワード変更時など） */
export async function destroyUserSessions(env: Env, userId: number) {
  await env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND kind = 'user'").bind(userId).run();
}

export async function getSessionUser(c: Context<AppEnv>): Promise<UserRow | null> {
  const token = getCookie(c, USER_COOKIE);
  if (!token) return null;
  const row = await c.env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.kind = 'user' AND s.expires_at > ?`,
  )
    .bind(await sha256Hex(token), nowSec())
    .first<UserRow>();
  return row ?? null;
}

export async function isAdmin(c: Context<AppEnv>): Promise<boolean> {
  const token = getCookie(c, ADMIN_COOKIE);
  if (!token) return false;
  const row = await c.env.DB.prepare(
    "SELECT 1 AS ok FROM sessions WHERE id = ? AND kind = 'admin' AND expires_at > ?",
  )
    .bind(await sha256Hex(token), nowSec())
    .first();
  return !!row;
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await getSessionUser(c);
  if (!user) {
    if (c.req.path.startsWith('/api/')) return c.json({ error: 'ログインが必要です。' }, 401);
    return c.redirect('/login');
  }
  c.set('user', user);
  await next();
};

// ---------------------------------------------------------------------------
// CSRF 対策：POST 等は同一オリジンからのみ受け付ける（SameSite=Lax と併用）
// ---------------------------------------------------------------------------
export const sameOriginOnly: MiddlewareHandler<AppEnv> = async (c, next) => {
  const m = c.req.method;
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return next();
  const self = new URL(c.req.url).origin;
  const origin = c.req.header('origin');
  const referer = c.req.header('referer');
  const src = origin ?? (referer ? new URL(referer).origin : null);
  if (src !== self) return c.text('Forbidden (cross-origin request)', 403);
  await next();
};

// ---------------------------------------------------------------------------
// ログイン試行のレート制限（15分あたり10回）
// ---------------------------------------------------------------------------
const RL_WINDOW = 15 * 60;
const RL_MAX = 10;

export async function rateLimitHit(env: Env, key: string): Promise<boolean> {
  const now = nowSec();
  const row = await env.DB.prepare('SELECT count, window_start FROM login_attempts WHERE key = ?')
    .bind(key)
    .first<{ count: number; window_start: number }>();
  if (!row || now - row.window_start > RL_WINDOW) {
    await env.DB.prepare(
      'INSERT INTO login_attempts (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start',
    )
      .bind(key, now)
      .run();
    return false;
  }
  if (row.count >= RL_MAX) return true;
  await env.DB.prepare('UPDATE login_attempts SET count = count + 1 WHERE key = ?').bind(key).run();
  return false;
}

export async function rateLimitReset(env: Env, key: string) {
  await env.DB.prepare('DELETE FROM login_attempts WHERE key = ?').bind(key).run();
}

export function clientIp(c: Context): string {
  return c.req.header('cf-connecting-ip') ?? 'local';
}
