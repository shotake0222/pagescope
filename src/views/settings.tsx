import type { FC } from 'hono/jsx';
import { describeInterval, type Plan } from '../lib/plans';
import { AppShell } from './app-shell';
import { Alert, Icon } from './layout';

const FLASH: Record<string, { kind: 'success' | 'error'; title: string }> = {
  password_ok: { kind: 'success', title: 'パスワードを変更しました。他の端末ではログアウトされます。' },
  password_wrong: { kind: 'error', title: '現在のパスワードが正しくありません。' },
  password_short: { kind: 'error', title: '新しいパスワードは8文字以上で入力してください。' },
  password_mismatch: { kind: 'error', title: '新しいパスワード（確認）が一致しません。' },
  slack_ok: { kind: 'success', title: 'Slack 通知の設定を保存しました。' },
  slack_invalid: { kind: 'error', title: 'Slack の Incoming Webhook URL（https://hooks.slack.com/... ）を入力してください。' },
  slack_test_ok: { kind: 'success', title: 'Slack にテスト通知を送信しました。チャンネルをご確認ください。' },
};

const input =
  'w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs text-slate-100 transition';
const label = 'block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5';

export const SettingsPage: FC<{ email: string; plan: Plan; slackUrl: string | null; flash?: string }> = (p) => {
  const flash = p.flash ? FLASH[p.flash] : undefined;
  return (
    <AppShell title="アカウント設定" email={p.email} active="settings">
      <main class="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold text-white">アカウント設定</h1>
          <a href="/dashboard" class="text-xs text-slate-400 hover:text-emerald-400">← ダッシュボードへ</a>
        </div>
        {flash && <Alert kind={flash.kind} title={flash.title} />}

        <section class="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-2xl">
          <h2 class="text-sm font-bold text-white mb-4">ご契約プラン</h2>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <Spec k="プラン" v={p.plan.label} />
            <Spec k="監視上限" v={`${p.plan.maxTargets}件`} />
            <Spec k="自動パトロール" v={describeInterval(p.plan.intervalSec)} />
            <Spec k="AIサマリー" v={p.plan.aiSummary ? 'あり' : 'なし'} />
          </div>
          <p class="text-[11px] text-slate-500 mt-4">
            プランの変更・請求書払いのご相談は <a href="/#contact" class="text-emerald-400 hover:underline">お問い合わせフォーム</a> からご連絡ください。
          </p>
        </section>

        <section class="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-2xl">
          <h2 class="text-sm font-bold text-white mb-1 flex items-center gap-2">
            <Icon name="bell" class="w-4 h-4 text-emerald-400" />
            Slack 通知
          </h2>
          <p class="text-[11px] text-slate-500 mb-4 leading-relaxed">
            差分を検知すると、AIサマリーと共有URLを Slack チャンネルに自動投稿します。Slack の「Incoming Webhooks」で発行した URL を貼り付けてください。
          </p>
          <form method="post" action="/settings/slack" class="space-y-3">
            <div>
              <label class={label} for="slack">Webhook URL</label>
              <input id="slack" type="url" name="slack_webhook_url" value={p.slackUrl ?? ''} placeholder="https://hooks.slack.com/services/..." class={input} />
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="submit" class="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 px-4 rounded-xl text-xs transition">保存</button>
              {p.slackUrl && (
                <button type="submit" formaction="/settings/slack/test" class="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 px-4 rounded-xl text-xs border border-slate-700 transition">
                  テスト送信
                </button>
              )}
            </div>
            <p class="text-[10px] text-slate-600">空欄で保存すると通知を停止します。</p>
          </form>
        </section>

        <section class="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-2xl">
          <h2 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Icon name="shield" class="w-4 h-4 text-emerald-400" />
            パスワード変更
          </h2>
          <form method="post" action="/settings/password" class="space-y-3 max-w-sm">
            <div>
              <label class={label} for="cur">現在のパスワード</label>
              <input id="cur" type="password" name="current" required autocomplete="current-password" class={input} />
            </div>
            <div>
              <label class={label} for="new">新しいパスワード（8文字以上）</label>
              <input id="new" type="password" name="password" required minlength={8} autocomplete="new-password" class={input} />
            </div>
            <div>
              <label class={label} for="new2">新しいパスワード（確認）</label>
              <input id="new2" type="password" name="password2" required minlength={8} autocomplete="new-password" class={input} />
            </div>
            <button type="submit" class="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2 px-4 rounded-xl text-xs transition">変更する</button>
          </form>
        </section>
      </main>
    </AppShell>
  );
};

const Spec: FC<{ k: string; v: string }> = ({ k, v }) => (
  <div class="bg-slate-950 border border-slate-800 rounded-xl p-3">
    <p class="text-[10px] text-slate-500 font-bold">{k}</p>
    <p class="text-sm font-bold text-slate-100 mt-1">{v}</p>
  </div>
);
