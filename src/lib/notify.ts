import type { Env } from '../env';

const IMPORTANCE_LABEL: Record<string, string> = { high: '🔴 重要度: 高', medium: '🟠 重要度: 中', low: '🟢 重要度: 低' };

/** Slack Incoming Webhook 通知（旧 cron_crawler.php のバイラルクレジット付き通知を移植） */
export async function sendSlack(
  env: Env,
  webhookUrl: string,
  p: { targetName: string; shareToken: string; summary?: string | null; importance?: string | null },
): Promise<void> {
  if (!/^https:\/\/hooks\.slack\.com\//.test(webhookUrl)) return;
  const shareUrl = `${env.APP_URL.replace(/\/$/, '')}/share/${p.shareToken}`;
  const lines = [
    `🚨 *【PageScope】競合LPのサイレント修正を検知しました！*`,
    `対象サイト: *${p.targetName}*`,
  ];
  if (p.importance && IMPORTANCE_LABEL[p.importance]) lines.push(IMPORTANCE_LABEL[p.importance]);
  if (p.summary) lines.push('', `> ${p.summary.slice(0, 280).replace(/\n+/g, '\n> ')}${p.summary.length > 280 ? '…' : ''}`);
  lines.push(
    '',
    '詳細・差分レポートはこちら（ログイン不要でチームに共有可能）',
    `👉 ${shareUrl}`,
    '',
    `_🔍 LPのサイレント修正を24時間自動パトロール中: <${env.APP_URL}|PageScope.online> (Powered by PageScope)_`,
  );
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: lines.join('\n') }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    console.warn(`[slack] 送信失敗: ${(e as Error).message}`);
  }
}

/** Resend API でメール送信（RESEND_API_KEY 未設定なら false） */
export async function sendMail(env: Env, to: string, subject: string, text: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM, to, subject, text }),
      signal: AbortSignal.timeout(10_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
