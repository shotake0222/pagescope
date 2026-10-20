import type { Child, FC } from 'hono/jsx';
import { Icon, Layout, LogoMark, Wordmark } from './layout';

/** ログイン後画面の共通ヘッダー */
export const AppShell: FC<{ title: string; email: string; active: 'dashboard' | 'settings'; actions?: Child; children?: Child }> = (p) => (
  <Layout title={`${p.title} - PageScope`} noindex bodyClass="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-emerald-500/30 overflow-x-hidden">
    <nav class="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-4 py-3.5 sm:px-6 shadow-xl shadow-slate-900/50">
      <div class="max-w-7xl mx-auto flex justify-between items-center h-12 gap-3">
        <a href="/dashboard" class="flex items-center gap-3 min-w-0">
          <LogoMark />
          <Wordmark class="text-lg hidden sm:inline" />
        </a>
        <div class="flex items-center gap-2 sm:gap-4">
          {p.actions}
          <div class="flex items-center gap-1 sm:gap-3 pl-2 sm:pl-4 border-l border-slate-800">
            <div class="hidden md:flex flex-col text-right">
              <span class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Logged in as</span>
              <span class="text-xs font-semibold text-slate-300">{p.email}</span>
            </div>
            <a
              href={p.active === 'settings' ? '/dashboard' : '/settings'}
              class={`p-2 rounded-lg transition ${p.active === 'settings' ? 'text-emerald-400 bg-slate-800' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
              title="アカウント設定"
            >
              <Icon name="cog" class="w-5 h-5" />
            </a>
            <form method="post" action="/logout">
              <button type="submit" class="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition" title="ログアウト">
                <Icon name="logout" class="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </nav>
    {p.children}
  </Layout>
);
