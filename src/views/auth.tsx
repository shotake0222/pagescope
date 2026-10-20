import type { Child, FC } from 'hono/jsx';
import { Layout, Wordmark } from './layout';

const input =
  'w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-100 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition';
const label = 'block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5';
const primaryBtn =
  'w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl text-sm transition active:scale-[0.99]';

const Card: FC<{ title: string; sub?: string; error?: string; success?: Child; children?: Child }> = (p) => (
  <Layout title={`${p.title} - PageScope`} noindex bodyClass="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center p-4 antialiased">
    <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
      <div class="text-center mb-8">
        <a href="/">
          <Wordmark class="text-2xl" />
        </a>
        <p class="text-xs text-slate-500 mt-2">{p.sub ?? p.title}</p>
      </div>
      {p.error && (
        <div class="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-bold text-red-400 text-center" role="alert">
          {p.error}
        </div>
      )}
      {p.success && (
        <div class="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs font-bold text-emerald-400 text-center leading-relaxed">
          {p.success}
        </div>
      )}
      {p.children}
    </div>
  </Layout>
);

export const LoginPage: FC<{ error?: string; notice?: string; email?: string }> = (p) => (
  <Card title="ログイン" error={p.error} success={p.notice}>
    <form method="post" action="/login" class="space-y-5">
      <div>
        <label class={label} for="email">Email Address</label>
        <input id="email" type="email" name="email" required autocomplete="email" value={p.email ?? ''} placeholder="you@example.com" class={input} />
      </div>
      <div>
        <label class={label} for="password">Password</label>
        <input id="password" type="password" name="password" required autocomplete="current-password" placeholder="••••••••" class={input} />
      </div>
      <button type="submit" class={primaryBtn}>ログイン</button>
    </form>
    <div class="mt-6 flex items-center justify-between text-[11px]">
      <a href="/forgot" class="text-slate-400 hover:text-emerald-400 transition">パスワードをお忘れの方</a>
      <a href="/#contact" class="text-slate-400 hover:text-emerald-400 transition">お申し込み・お問い合わせ</a>
    </div>
  </Card>
);

export const ForgotPage: FC<{ sent?: boolean; mailEnabled: boolean; error?: string }> = (p) => (
  <Card
    title="パスワード再設定"
    error={p.error}
    success={p.sent ? '入力されたメールアドレスが登録済みの場合、再設定用のリンクを送信しました。メールをご確認ください（有効期限1時間）。' : undefined}
  >
    {p.mailEnabled ? (
      !p.sent && (
        <form method="post" action="/forgot" class="space-y-5">
          <div>
            <label class={label} for="email">登録メールアドレス</label>
            <input id="email" type="email" name="email" required autocomplete="email" class={input} />
          </div>
          <button type="submit" class={primaryBtn}>再設定リンクを送る</button>
        </form>
      )
    ) : (
      <p class="text-xs text-slate-400 leading-relaxed text-center">
        パスワードの再発行は運営にて承っております。
        <br />
        <a href="/#contact" class="text-emerald-400 hover:underline font-bold">お問い合わせフォーム</a>
        よりご登録のメールアドレスをお知らせください。
      </p>
    )}
    <p class="mt-6 text-center text-[11px]">
      <a href="/login" class="text-slate-400 hover:text-emerald-400">← ログイン画面に戻る</a>
    </p>
  </Card>
);

export const ResetPage: FC<{ token: string; error?: string; invalid?: boolean }> = (p) => (
  <Card title="新しいパスワードの設定" error={p.invalid ? 'このリンクは無効か、有効期限が切れています。' : p.error}>
    {!p.invalid && (
      <form method="post" action="/reset" class="space-y-5">
        <input type="hidden" name="token" value={p.token} />
        <div>
          <label class={label} for="password">新しいパスワード（8文字以上）</label>
          <input id="password" type="password" name="password" required minlength={8} autocomplete="new-password" class={input} />
        </div>
        <button type="submit" class={primaryBtn}>パスワードを変更する</button>
      </form>
    )}
    <p class="mt-6 text-center text-[11px]">
      <a href="/login" class="text-slate-400 hover:text-emerald-400">← ログイン画面に戻る</a>
    </p>
  </Card>
);

export const AdminLoginPage: FC<{ error?: string; notConfigured?: boolean }> = (p) => (
  <Card title="ADMIN" sub="PageScope 運営管理システム" error={p.notConfigured ? '管理者アカウントが未設定です。ADMIN_USER / ADMIN_PASSWORD を secret に登録してください。' : p.error}>
    <form method="post" action="/admin/login" class="space-y-5">
      <div>
        <label class={label} for="u">管理者ID</label>
        <input id="u" type="text" name="login_user" required autocomplete="username" class={input} />
      </div>
      <div>
        <label class={label} for="p">パスワード</label>
        <input id="p" type="password" name="login_pass" required autocomplete="current-password" class={input} />
      </div>
      <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl text-sm transition">
        認証して入室
      </button>
    </form>
  </Card>
);
