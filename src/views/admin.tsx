import type { FC } from 'hono/jsx';
import { PLANS, PLAN_IDS } from '../lib/plans';
import { formatJst } from '../lib/util';
import { Layout } from './layout';

export interface AdminUserRow {
  id: number;
  email: string;
  plan_type: string;
  admin_memo: string | null;
  created_at: number;
  target_count: number;
  last_detected_at: number | null;
}

export const AdminPage: FC<{
  users: AdminUserRow[];
  message?: string;
  error?: string;
  generatedPassword?: string;
  stats: { targets: number; histories: number; errors: number };
}> = (p) => (
  <Layout title="PageScope 運営管理画面" noindex bodyClass="bg-slate-950 text-slate-100 antialiased p-4 sm:p-8">
    <div class="max-w-7xl mx-auto">
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-6 mb-8 gap-4">
        <div>
          <h1 class="text-2xl font-bold text-white flex items-center gap-2">
            🛡️ PageScope <span class="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full font-mono">ADMIN</span>
          </h1>
          <p class="text-xs text-slate-400 mt-1">
            ユーザーの登録・契約プランの管理を行います。 監視対象 {p.stats.targets} 件 / 検知履歴 {p.stats.histories} 件 / 取得エラー中 {p.stats.errors} 件
          </p>
        </div>
        <div class="flex items-center gap-3">
          <a href="/" target="_blank" class="text-xs text-slate-400 hover:text-emerald-400 transition bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
            公式LPを確認する ➔
          </a>
          <form method="post" action="/admin/logout">
            <button class="text-xs text-red-400 hover:text-white transition bg-red-500/10 hover:bg-red-500/30 border border-red-500/20 px-3 py-1.5 rounded-lg">ログアウト</button>
          </form>
        </div>
      </div>

      {p.message && (
        <div class="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-xl font-medium">
          <p>✅ {p.message}</p>
          {p.generatedPassword && (
            <div class="mt-3 p-4 bg-slate-950/80 border border-emerald-500/50 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p class="text-xs text-emerald-300/80 uppercase tracking-wider font-bold mb-1">自動生成されたパスワード</p>
                <p class="text-xl font-mono text-white font-bold select-all tracking-widest">{p.generatedPassword}</p>
              </div>
              <div class="text-[10px] text-red-400 bg-red-500/10 px-3 py-2 rounded border border-red-500/20 shrink-0">
                ⚠️ この画面を閉じると二度と表示されません。
                <br />
                必ずコピーしてお客様へ共有してください。
              </div>
            </div>
          )}
        </div>
      )}
      {p.error && <div class="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-xl font-medium">⚠️ {p.error}</div>}

      <div class="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div class="xl:col-span-1">
          <div class="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h2 class="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-slate-800 pb-2">➕ 新規アカウント発行</h2>
            <form method="post" action="/admin/users" class="space-y-4">
              <div>
                <label class="block text-xs font-bold text-slate-400 mb-1" for="email">メールアドレス (ID)</label>
                <input id="email" type="email" name="email" required placeholder="user@example.com" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500" />
              </div>
              <div>
                <p class="block text-xs font-bold text-slate-400 mb-1">パスワード</p>
                <div class="w-full bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2.5 text-xs text-slate-500 font-mono">🔒 14桁の安全なパスワードを自動生成</div>
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-400 mb-1" for="plan">初期プラン</label>
                <select id="plan" name="plan_type" class="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-emerald-500">
                  {PLAN_IDS.map((id) => (
                    <option value={id}>
                      {PLANS[id].label}（上限{PLANS[id].maxTargets}件）
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-lg text-sm transition">
                アカウントを作成する
              </button>
            </form>
          </div>
        </div>

        <div class="xl:col-span-3">
          <div class="bg-slate-900/40 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div class="p-6 border-b border-slate-800 bg-slate-900/60">
              <h2 class="text-sm font-bold text-slate-300 uppercase tracking-wider">登録ユーザー一覧（総数: {p.users.length}名）</h2>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm whitespace-nowrap">
                <thead class="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                  <tr>
                    <th class="px-5 py-4 font-semibold w-16">ID</th>
                    <th class="px-5 py-4 font-semibold">メールアドレス</th>
                    <th class="px-5 py-4 font-semibold">利用状況</th>
                    <th class="px-5 py-4 font-semibold w-64">運営用メモ</th>
                    <th class="px-5 py-4 font-semibold w-32">契約プラン</th>
                    <th class="px-5 py-4 font-semibold text-right w-36">操作</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60">
                  {p.users.length === 0 ? (
                    <tr>
                      <td colspan={6} class="px-6 py-10 text-center text-slate-500 text-xs">
                        まだ登録ユーザーはいません。左側のフォームから追加してください。
                      </td>
                    </tr>
                  ) : (
                    p.users.map((u) => {
                      const formId = `update_${u.id}`;
                      const limit = PLANS[u.plan_type as keyof typeof PLANS]?.maxTargets ?? 1;
                      return (
                        <tr class="hover:bg-slate-900/30 transition">
                          <td class="px-5 py-4 font-mono text-xs text-slate-400 align-top">{u.id}</td>
                          <td class="px-5 py-4 font-medium text-white align-top">
                            {u.email}
                            <div class="text-[10px] text-slate-500 font-normal mt-1">登録 {formatJst(u.created_at)}</div>
                          </td>
                          <td class="px-5 py-4 text-xs text-slate-400 align-top">
                            監視 {u.target_count}/{limit}件
                            <div class="text-[10px] text-slate-500 mt-1">最終検知 {u.last_detected_at ? formatJst(u.last_detected_at, true) : '—'}</div>
                          </td>
                          <td class="px-5 py-3 align-top">
                            <form id={formId} method="post" action={`/admin/users/${u.id}`}></form>
                            <textarea name="admin_memo" form={formId} rows={2} placeholder="メモ" class="w-full bg-slate-950 border border-slate-700/50 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-emerald-500 resize-none">
                              {u.admin_memo ?? ''}
                            </textarea>
                          </td>
                          <td class="px-5 py-3 align-top">
                            <select name="plan_type" form={formId} class="w-full bg-slate-950 border border-slate-700/50 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500">
                              {PLAN_IDS.map((id) => (
                                <option value={id} selected={u.plan_type === id}>
                                  {PLANS[id].label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td class="px-5 py-3 align-top text-right space-y-2">
                            <button type="submit" form={formId} class="w-full bg-slate-800 hover:bg-emerald-600 border border-slate-700 text-slate-300 font-medium px-3 py-1.5 rounded-lg text-xs transition">
                              保存
                            </button>
                            <form method="post" action={`/admin/users/${u.id}/reset-password`} data-confirm="パスワードをリセットしますか？（このユーザーはログアウトされます）">
                              <button type="submit" class="w-full bg-slate-950 hover:bg-amber-600 border border-amber-900/50 text-amber-500 hover:text-white font-medium px-3 py-1.5 rounded-lg text-xs transition">
                                パスリセット
                              </button>
                            </form>
                            <form method="post" action={`/admin/users/${u.id}/delete`} data-confirm="このユーザーと監視対象・履歴・スクリーンショットを完全に削除しますか？">
                              <button type="submit" class="w-full bg-slate-950 hover:bg-red-600 border border-red-900/50 text-red-500 hover:text-white font-medium px-3 py-1.5 rounded-lg text-xs transition">
                                削除
                              </button>
                            </form>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
    <script src="/assets/confirm.js" defer></script>
  </Layout>
);
