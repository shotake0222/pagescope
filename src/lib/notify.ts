import type { Env } from '../env';

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
