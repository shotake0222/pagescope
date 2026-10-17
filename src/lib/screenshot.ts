import type { Env } from '../env';

/**
 * Google PageSpeed Insights API でスクリーンショットを撮影し、R2 に保存する。
 * （旧版はサーバーの /screenshots フォルダに保存していた）
 * PAGESPEED_API_KEY を登録すると、キーなしより安定して撮影できます。
 * @returns R2 のオブジェクトキー。失敗時は null
 */
export async function captureScreenshot(env: Env, url: string, token: string): Promise<string | null> {
  const api = new URL(`${(env.PAGESPEED_API_BASE || 'https://www.googleapis.com').replace(/\/$/, '')}/pagespeedonline/v5/runPagespeed`);
  api.searchParams.set('url', url);
  api.searchParams.set('category', 'PERFORMANCE');
  api.searchParams.set('strategy', 'desktop');
  if (env.PAGESPEED_API_KEY) api.searchParams.set('key', env.PAGESPEED_API_KEY);

  try {
    const res = await fetch(api.toString(), { signal: AbortSignal.timeout(90_000) });
    if (!res.ok) {
      console.warn(`[screenshot] PageSpeed API ${res.status}`);
      return null;
    }
    const data = (await res.json()) as any;
    const dataUri: string | undefined = data?.lighthouseResult?.audits?.['final-screenshot']?.details?.data;
    const m = dataUri?.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
    if (!m) return null;
    const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    const ext = m[1] === 'image/png' ? 'png' : m[1] === 'image/webp' ? 'webp' : 'jpg';
    const key = `shot_${token}.${ext}`;
    await env.SCREENSHOTS.put(key, bytes, { httpMetadata: { contentType: m[1] } });
    return key;
  } catch (e) {
    console.warn(`[screenshot] 失敗: ${(e as Error).message}`);
    return null;
  }
}
