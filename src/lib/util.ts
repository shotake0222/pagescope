const enc = new TextEncoder();

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function randomHex(bytes: number): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** 紛らわしい文字（0/O, 1/l 等）を除いた読みやすいパスワード */
export function randomPassword(length = 14): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = crypto.getRandomValues(new Uint8Array(length));
  return [...b].map((x) => chars[x % chars.length]).join('');
}

export async function sha256Hex(input: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** タイミング攻撃を避ける文字列比較 */
export function safeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

const jstFmt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** UNIX 秒 → "2026/10/17 18:00"（JST） */
export function formatJst(sec: number | null | undefined, short = false): string {
  if (!sec) return '';
  const parts = Object.fromEntries(jstFmt.formatToParts(new Date(sec * 1000)).map((p) => [p.type, p.value]));
  const hm = `${parts.hour}:${parts.minute}`;
  return short ? `${parts.month}/${parts.day} ${hm}` : `${parts.year}/${parts.month}/${parts.day} ${hm}`;
}

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
}

export function normalizeUrl(v: string): string | null {
  try {
    const u = new URL(v.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
