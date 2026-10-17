/**
 * ページ取得 & 監視エリアのテキスト抽出
 * - PHP 版の DOMDocument + 簡易 XPath 変換の代わりに、Workers 標準の HTMLRewriter を使用
 * - CSS セレクタは HTMLRewriter がそのまま解釈するため、".a", "#b" だけでなく
 *   "main .price-box", "section > h2", ".a, .b" なども指定可能になりました
 * - <script> / <style> / <noscript> / <template> / <svg> の中身は除外
 * - Shift_JIS / EUC-JP のページも文字化けせずに取得
 */

const SKIP_TAGS = ['script', 'style', 'noscript', 'template', 'svg', 'iframe'];
const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt', 'fieldset', 'figcaption',
  'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav',
  'ol', 'p', 'pre', 'section', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul', 'option',
  'button', 'label',
]);
const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr',
]);

const MAX_BYTES = 5 * 1024 * 1024; // 5MB を超えるページは打ち切り
const USER_AGENT = 'Mozilla/5.0 (compatible; PageScope-Patrol/2.0; +https://pagescope.online/)';

export class FetchError extends Error {}

export interface ExtractResult {
  text: string;
  matched: boolean; // セレクタに一致する要素があったか
  finalUrl: string;
}

export function normalizeSelector(sel: string | null | undefined): string {
  const s = (sel ?? '').trim();
  return s === '' ? 'body' : s;
}

/** HTMLRewriter が解釈できるセレクタか事前に検証する */
export function validateSelector(sel: string): boolean {
  try {
    new HTMLRewriter().on(sel, {});
    return true;
  } catch {
    return false;
  }
}

async function readLimited(res: Response): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(Math.min(total, MAX_BYTES));
  let off = 0;
  for (const ch of chunks) {
    const n = Math.min(ch.byteLength, out.byteLength - off);
    out.set(ch.subarray(0, n), off);
    off += n;
  }
  return out;
}

function detectCharset(contentType: string | null, head: Uint8Array): string {
  const fromHeader = contentType?.match(/charset=["']?([\w-]+)/i)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const ascii = new TextDecoder('latin1').decode(head.subarray(0, 4096));
  const fromMeta = ascii.match(/<meta[^>]+charset=["']?\s*([\w-]+)/i)?.[1];
  return (fromMeta ?? 'utf-8').toLowerCase();
}

function decode(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

export async function fetchPage(url: string): Promise<{ html: string; finalUrl: string }> {
  let res: Response;
  try {
    res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en;q=0.8',
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    throw new FetchError(`接続できませんでした（${(e as Error).message}）`);
  }
  if (!res.ok) throw new FetchError(`HTTP ${res.status} が返されました`);
  const bytes = await readLimited(res);
  const html = decode(bytes, detectCharset(res.headers.get('content-type'), bytes));
  return { html, finalUrl: res.url || url };
}

/** HTML から、セレクタに一致する要素内のテキストだけを抜き出す */
export async function extractText(html: string, selector: string): Promise<{ text: string; matched: boolean }> {
  let inside = 0; // セレクタ一致要素の入れ子の深さ
  let skip = 0; // script/style 等の中にいるか
  let matched = false;
  const parts: string[] = [];

  // 注意: HTMLRewriter は 1 要素につき onEndTag を 1 つしか保持しない（後から登録した方で上書きされる）。
  // そのため、セレクタ一致・除外タグの判定は「フラグを立てるだけ」にして、
  // 終了タグの処理は最後に登録する '*' ハンドラの 1 か所にまとめています。
  // （同じ要素に一致したハンドラは登録順に呼ばれます）
  let pendingMatch = false;
  let pendingSkip = false;

  const rewriter = new HTMLRewriter()
    .on(selector, {
      element() {
        matched = true;
        pendingMatch = true;
      },
    })
    .on(SKIP_TAGS.join(','), {
      element() {
        pendingSkip = true;
      },
    })
    .on('*', {
      element(el) {
        const isMatch = pendingMatch;
        const isSkip = pendingSkip;
        pendingMatch = false;
        pendingSkip = false;

        // 画像の代替テキストも変更検知の対象にする（バナー差し替え検知）
        if ((inside > 0 || isMatch) && skip === 0 && el.tagName === 'img') {
          const alt = el.getAttribute('alt')?.trim();
          if (alt) parts.push(` [画像: ${alt}] `);
        }

        const isBlock = BLOCK_TAGS.has(el.tagName);
        // selfClosing は実行時には存在するが、型定義に未収録のためキャストして参照
        if (VOID_TAGS.has(el.tagName) || (el as Element & { selfClosing?: boolean }).selfClosing) {
          if (inside > 0 && isBlock) parts.push('\n'); // <br>, <hr>
          return;
        }

        const enters = isMatch;
        const breaks = enters || (inside > 0 && isBlock);
        if (enters) inside++;
        if (isSkip) skip++;
        if (breaks) parts.push('\n');
        if (!enters && !isSkip && !breaks) return;

        try {
          el.onEndTag(() => {
            if (breaks) parts.push('\n');
            if (enters) inside = Math.max(0, inside - 1);
            if (isSkip) skip = Math.max(0, skip - 1);
          });
        } catch {
          // 終了タグを持てない要素（壊れた HTML など）は、深さを元に戻して無視
          if (enters) inside = Math.max(0, inside - 1);
          if (isSkip) skip = Math.max(0, skip - 1);
        }
      },
    })
    .onDocument({
      text(t) {
        if (inside > 0 && skip === 0) parts.push(t.text);
      },
    });

  await rewriter.transform(new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })).arrayBuffer();
  return { text: normalizeText(decodeEntities(parts.join(''))), matched };
}

/** 空白を整理しつつ、行構造（差分表示の見やすさ）は保つ */
export function normalizeText(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\t  　]+/g, ' ').trim())
    .filter((line) => line !== '')
    .join('\n');
}

const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', yen: '¥', copy: '©', reg: '®',
  trade: '™', hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»', times: '×', middot: '·',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return NAMED[code.toLowerCase()] ?? m;
  });
}

export async function fetchAndExtract(url: string, selector: string): Promise<ExtractResult> {
  const { html, finalUrl } = await fetchPage(url);
  const { text, matched } = await extractText(html, selector);
  return { text, matched, finalUrl };
}
