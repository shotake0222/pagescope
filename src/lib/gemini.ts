import type { Env } from '../env';
import { sleep } from './util';

export interface AiInsight {
  summary: string;
  importance: 'high' | 'medium' | 'low' | 'none';
  tags: string[];
  error?: boolean;
}

const SYSTEM_PROMPT = `あなたは個人事業主や中小企業（SMB）のマーケティング支援に特化した、極めて優秀な戦略コンサルタントです。
競合のランディングページ（LP）で検知されたテキスト差分を分析します。

【厳守するルール】
1. マークダウン記号（** や # など）は一切使わず、プレーンテキストで書くこと。段落の区切りは改行で表す。
2. 空白・改行・日付・アクセスカウンター・システム的な記号など「意味のある変更」がない場合は、summary を「特筆すべき変更はありません。」の一文のみとし、importance を none にすること。
3. 意味のある変更がある場合は、まず「何がどう変わったか」を具体的な数字・文言を引用して1〜2文で示すこと。
4. 次に、人が気づきにくい背後にある「競合の戦略的意図」を鋭く推論すること。
5. その推論を元に、個人・中小企業が取るべき「具体的な対抗策（次の一手）」を2〜3個提案すること。
6. 全体で800文字以内に、要点を突いた簡潔な表現でまとめ、文章を途中で途切れさせないこと。
7. tags には「プライシング変更」「オファー内容変更」「キャッチコピー変更」「CTA変更」「機能・仕様変更」「キャンペーン開始」「キャンペーン終了」「信頼性訴求の変更」「デザイン・構成変更」などから該当するものを最大3個入れること。`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING', description: 'プレーンテキストの分析レポート' },
    importance: { type: 'STRING', enum: ['high', 'medium', 'low', 'none'] },
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['summary', 'importance', 'tags'],
};

export async function generateInsight(
  env: Env,
  input: { targetName: string; url: string; diffExcerpt: string; before: string; after: string },
): Promise<AiInsight> {
  if (!env.GEMINI_API_KEY) {
    return { summary: '【AI未設定】GEMINI_API_KEY が登録されていないため、AIサマリーを生成できませんでした。', importance: 'none', tags: [], error: true };
  }
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const userText = `【監視対象】${input.targetName}（${input.url}）

【変更箇所の抜粋】（"- " は削除された行、"+ " は追加された行、"  " は前後の文脈）
${input.diffExcerpt}

【参考：変更後のテキスト冒頭】
${input.after.slice(0, 1500)}`;

  const generationConfig: Record<string, unknown> = {
    temperature: 0.3,
    maxOutputTokens: 2048,
    responseMimeType: 'application/json',
    responseSchema: RESPONSE_SCHEMA,
  };
  // 2.5 Flash は思考トークンが出力枠を食い、レポートが途中で切れることがあるため無効化
  if (/2\.5-flash/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig,
  });
  const apiBase = (env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com').replace(/\/$/, '');
  const url = `${apiBase}/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const maxAttempts = 4; // 待機 5s → 10s → 20s（429/503 の指数バックオフ）
  let lastError = '不明なエラー';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body,
        signal: AbortSignal.timeout(60_000),
      });
    } catch (e) {
      lastError = `通信エラー: ${(e as Error).message}`;
      if (attempt < maxAttempts) {
        await sleep(2000 * attempt);
        continue;
      }
      break;
    }

    if (res.ok) {
      const data = (await res.json()) as any;
      const cand = data?.candidates?.[0];
      const text: string | undefined = cand?.content?.parts?.map((p: any) => p.text ?? '').join('');
      if (!text) {
        if (data?.promptFeedback?.blockReason || cand?.finishReason === 'SAFETY') {
          return { summary: '【AI取得エラー】Googleのセーフティフィルターによりブロックされました。差分は下記でご確認ください。', importance: 'none', tags: [], error: true };
        }
        lastError = `空の応答（finishReason: ${cand?.finishReason ?? '不明'}）`;
        break;
      }
      return parseInsight(text);
    }

    const err = (await res.json().catch(() => null)) as any;
    lastError = `コード ${res.status} [${err?.error?.status ?? 'UNKNOWN'}] ${err?.error?.message ?? ''}`.trim();
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < maxAttempts) {
      const wait = res.status === 429 || res.status === 503 ? 5000 * 2 ** (attempt - 1) : 2000 * attempt;
      console.warn(`[gemini] ${res.status} → ${wait / 1000}s 待機して再試行 (${attempt}/${maxAttempts})`);
      await sleep(wait);
      continue;
    }
    break;
  }
  return { summary: `【APIエラー】AIサマリーを生成できませんでした（${lastError}）。差分は下記でご確認ください。`, importance: 'none', tags: [], error: true };
}

function cleanText(s: string): string {
  return s.replace(/\*\*|__|`{1,3}|^#+\s*|^-{3,}$/gm, '').trim();
}

function parseInsight(raw: string): AiInsight {
  try {
    const j = JSON.parse(raw.replace(/^```(?:json)?|```$/g, '').trim());
    const importance = ['high', 'medium', 'low', 'none'].includes(j.importance) ? j.importance : 'medium';
    const tags = Array.isArray(j.tags) ? j.tags.filter((t: unknown) => typeof t === 'string').slice(0, 3) : [];
    return { summary: cleanText(String(j.summary ?? '')), importance, tags };
  } catch {
    // JSON で返らなかった場合はテキストとして扱う
    return { summary: cleanText(raw), importance: 'medium', tags: [] };
  }
}
