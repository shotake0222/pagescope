import type { FC } from 'hono/jsx';
import type { HistoryRow, TargetRow } from '../env';
import { describeInterval, type Plan } from '../lib/plans';
import { formatJst } from '../lib/util';
import { AppShell } from './app-shell';
import { Alert, Icon, jsonForScript } from './layout';

export type TimelineRow = HistoryRow & { target_name: string; target_url: string };

const FLASH: Record<string, { kind: 'success' | 'error' | 'info'; title: string; body: string }> = {
  registered: { kind: 'success', title: '新しいLPを監視対象に追加しました', body: '右上の「即時パトロール実行」を押すと、待たずに初回データを保存できます。' },
  deleted: { kind: 'info', title: '監視URLの削除が完了しました', body: '指定されたターゲットのパトロールを停止し、空き枠を作成しました。' },
  invalid_url: { kind: 'error', title: 'URLの形式エラー', body: '有効なURL（http:// または https:// から始まるもの）を入力してください。' },
  invalid_selector: { kind: 'error', title: 'CSSセレクタの形式エラー', body: '例：.price-box / #main-catchcopy / main h2 のような形式で入力してください。' },
  limit: { kind: 'error', title: '登録スロット上限エラー', body: '現在のプランの上限を超えています。不要なURLを削除するかプラン変更をご検討ください。' },
  insert: { kind: 'error', title: 'データベース登録エラー', body: '登録処理中に予期せぬエラーが発生しました。' },
  delete: { kind: 'error', title: 'データベース削除エラー', body: '紐づくデータの削除に失敗しました。' },
};

const IMPORTANCE: Record<string, { label: string; cls: string }> = {
  high: { label: '重要度: 高', cls: 'border-red-900/50 bg-red-500/10 text-red-400' },
  medium: { label: '重要度: 中', cls: 'border-amber-900/50 bg-amber-500/10 text-amber-400' },
  low: { label: '重要度: 低', cls: 'border-slate-700 bg-slate-900 text-slate-400' },
  none: { label: '変更軽微', cls: 'border-slate-800 bg-slate-900 text-slate-500' },
};

export function parseTags(json: string | null): string[] {
  try {
    const v = JSON.parse(json ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export const DashboardPage: FC<{
  email: string;
  plan: Plan;
  targets: TargetRow[];
  histories: TimelineRow[];
  totalAlerts: number;
  totalHistories: number;
  page: number;
  perPage: number;
  filterId: number | null;
  flash?: string;
  appUrl: string;
}> = (p) => {
  const count = p.targets.length;
  const full = count >= p.plan.maxTargets;
  const totalPages = Math.max(1, Math.ceil(p.totalHistories / p.perPage));
  const offset = (p.page - 1) * p.perPage;
  const flash = p.flash ? FLASH[p.flash] : undefined;
  const filterParam = p.filterId ? `&filter_id=${p.filterId}` : '';
  const erroring = p.targets.filter((t) => t.last_error).length;

  return (
    <AppShell
      title="Dashboard"
      email={p.email}
      active="dashboard"
      actions={
        <button
          id="patrol-btn"
          type="button"
          disabled={count === 0}
          class="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-3 sm:px-4 rounded-xl shadow-lg shadow-indigo-500/20 transition flex items-center gap-1.5 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Icon name="bolt" id="patrol-icon" />
          <span id="patrol-text" class="hidden sm:inline">即時パトロール実行</span>
        </button>
      }
    >
      <div class="bg-gradient-to-b from-slate-900 to-slate-950 pb-20 pt-10 border-b border-slate-900 relative">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 relative z-10">
          <div>
            <h1 class="text-2xl font-bold text-white tracking-tight">コントロールパネル</h1>
            <p class="mt-1 text-sm text-slate-400">登録されたLPの監視状況と、最新の変更検知レポートを一元管理します。</p>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/50 border border-slate-700/50 text-[10px] text-slate-300 font-medium">
                <Icon name="clock" class="w-3.5 h-3.5 text-blue-400" />
                自動パトロールは{describeInterval()}実行されます
              </span>
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/50 border border-slate-700/50 text-[10px] text-slate-300 font-medium">
                <Icon name="info" class="w-3.5 h-3.5 text-amber-400" />
                変更が検知されなかった場合、タイムラインは更新されません
              </span>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-[10px] text-red-300 font-medium">
                <Icon name="warn" class="w-3.5 h-3.5 text-red-400" />
                AIサマリーは、APIの混雑状況等により一時的にエラーとなる場合があります
              </span>
              <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/50 border border-slate-700/50 text-[10px] text-slate-300 font-medium">
                <Icon name="eye" class="w-3.5 h-3.5 text-indigo-400" />
                「特筆すべき変更はありません」と表示された場合も、念のため差分を目視でご確認ください
              </span>
            </div>
          </div>
          <div class="text-left sm:text-right shrink-0">
            <p class="text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">現在の契約プラン</p>
            <span class="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold uppercase tracking-wider">
              {p.plan.label}プラン
            </span>
          </div>
        </div>
      </div>

      <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 pb-12 relative z-20">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Stat icon="eye" tone="blue" label="監視中のLP数" value={String(count)} unit={`/ ${p.plan.maxTargets} slots`} />
          <Stat icon="check" tone="emerald" label="トータル検知数" value={String(p.totalAlerts)} unit="reports" />
          <div class="bg-slate-900 rounded-2xl p-5 shadow-xl border border-slate-800/80 flex items-center gap-4">
            <div class={`w-12 h-12 rounded-xl flex items-center justify-center border ${erroring ? 'bg-red-500/10 text-red-400 border-red-500/10' : 'bg-amber-500/10 text-amber-400 border-amber-500/10'}`}>
              <Icon name="bolt" class="w-6 h-6" />
            </div>
            <div>
              <p class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">クローラー状況</p>
              <p class="text-xs font-bold text-slate-300 mt-2 flex items-center gap-1.5 bg-slate-950/60 px-2.5 py-1 border border-slate-800 rounded-lg">
                <span class={`w-1.5 h-1.5 rounded-full animate-pulse ${erroring ? 'bg-red-400' : 'bg-emerald-400'}`}></span>
                {erroring ? `${erroring}件で取得エラーあり` : 'パトロール正常稼働中'}
              </p>
            </div>
          </div>
        </div>

        {flash && (
          <Alert kind={flash.kind} title={flash.title}>
            {flash.body}
          </Alert>
        )}

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* 左カラム：登録フォーム＋監視中リスト */}
          <div class="lg:col-span-1 space-y-6">
            <div class="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-2xl">
              <h2 class="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Icon name="plus" class="w-4 h-4 text-emerald-400" />
                新規パトロールLP登録
              </h2>
              <form method="post" action="/dashboard/targets" class="space-y-4">
                <Field label="識別名称 / クライアント名" name="target_name" placeholder="例：A社 リスティング用夏キャンペーンLP" required maxlength={120} />
                <Field label="ターゲットURL" name="target_url" type="url" placeholder="https://example.com/campaign/lp" required />
                <div>
                  <Field label="特定エリア抽出 (CSSセレクタ)" name="selector" placeholder="例：.price-box や #main-catchcopy" maxlength={200} />
                  <p class="text-[9px] text-slate-500 mt-1.5 leading-normal">
                    💡 空欄時はページ全体を監視。クラスは「.」、IDは「#」を先頭に。「main h2」「.a, .b」のような指定も可能です。
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={full}
                  class="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-slate-950 font-bold py-2.5 px-4 rounded-xl transition shadow-lg text-xs flex justify-center items-center gap-1.5 active:scale-[0.99]"
                >
                  {full ? `上限（${p.plan.maxTargets}件）に達しています` : '監視パトロールを展開'}
                  {!full && <Icon name="arrow-right" class="w-3.5 h-3.5" />}
                </button>
              </form>
            </div>

            <div class="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-2xl">
              <div class="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
                <h2 class="text-sm font-bold text-white flex items-center gap-2">
                  <Icon name="list" class="w-4 h-4 text-slate-400" />
                  現在パトロール中のLP
                </h2>
                <span class="text-[10px] font-mono bg-slate-950 border border-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-bold">
                  {count}/{p.plan.maxTargets}
                </span>
              </div>
              <div class="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {p.targets.length === 0 ? (
                  <div class="text-center py-12">
                    <div class="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center mx-auto mb-3 border border-slate-800">
                      <Icon name="link" class="w-5 h-5 text-slate-600" />
                    </div>
                    <p class="text-xs text-slate-500 font-medium">現在登録中の監視URLはありません</p>
                  </div>
                ) : (
                  p.targets.map((t) => <TargetCard t={t} />)
                )}
              </div>
            </div>
          </div>

          {/* 右カラム：タイムライン */}
          <div class="lg:col-span-2">
            <div class="bg-slate-900 p-5 sm:p-6 rounded-2xl border border-slate-800 shadow-2xl h-full flex flex-col">
              <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4 border-b border-slate-800 pb-4">
                <h2 class="text-sm font-bold text-white flex items-center gap-2">
                  <Icon name="bell" class="w-4 h-4 text-red-500" />
                  サイレント修正タイムライン
                </h2>
                <form method="get" action="/dashboard" class="w-full sm:w-auto">
                  <select
                    name="filter_id"
                    data-autosubmit
                    class="w-full sm:w-auto bg-slate-950 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
                  >
                    <option value="">🌐 すべてのLP履歴を表示</option>
                    {p.targets.map((t) => (
                      <option value={String(t.id)} selected={p.filterId === t.id}>
                        🔍 {t.target_name} のみ
                      </option>
                    ))}
                  </select>
                  <noscript>
                    <button class="ml-2 text-xs text-slate-300">表示</button>
                  </noscript>
                </form>
              </div>

              <div class="relative grow overflow-y-auto pr-2 max-h-[900px]">
                {p.histories.length === 0 ? (
                  <div class="text-center py-16 px-4 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-950/30 mt-4">
                    <div class="w-14 h-14 bg-slate-950 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-800">
                      <Icon name="shield" class="w-6 h-6 text-slate-600" />
                    </div>
                    <h3 class="text-xs font-bold text-slate-400">現在、該当する修正アラートはありません</h3>
                    <p class="text-[11px] text-slate-500 mt-2 leading-relaxed max-w-xs mx-auto">
                      右上の「即時パトロール実行」ボタンを押すと、登録されたLPの変更を検知してレポートを作成します。
                    </p>
                  </div>
                ) : (
                  <div class="relative mt-2">
                    <div class="absolute top-4 bottom-0 left-5 w-px bg-slate-800"></div>
                    <div class="space-y-5">
                      {p.histories.map((h) => (
                        <TimelineItem h={h} appUrl={p.appUrl} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div class="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
                  <div class="text-[11px] font-bold text-slate-500">
                    全 {p.totalHistories} 件中{' '}
                    <span class="text-slate-300">
                      {offset + 1} 〜 {Math.min(offset + p.perPage, p.totalHistories)}
                    </span>{' '}
                    件目
                  </div>
                  <div class="flex items-center gap-2">
                    <PageLink enabled={p.page > 1} href={`/dashboard?page=${p.page - 1}${filterParam}`} dir="prev" n={p.perPage} />
                    <PageLink enabled={p.page < totalPages} href={`/dashboard?page=${p.page + 1}${filterParam}`} dir="next" n={p.perPage} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <div
        id="toast"
        class="fixed bottom-5 right-5 translate-y-full opacity-0 transition-all duration-300 z-50 flex items-center gap-3 bg-slate-900 border border-slate-800 text-white px-5 py-3.5 rounded-xl shadow-2xl pointer-events-none max-w-sm"
      >
        <div id="toast-icon" class="w-7 h-7 rounded-full flex items-center justify-center border shrink-0"></div>
        <div>
          <p id="toast-title" class="text-xs font-bold text-slate-200"></p>
          <p id="toast-desc" class="text-[10px] text-slate-500 mt-0.5"></p>
        </div>
      </div>

      <script type="application/json" id="dashboard-data"
        dangerouslySetInnerHTML={{ __html: jsonForScript({ targets: p.targets.map((t) => ({ id: t.id, name: t.target_name })) }) }}
      />
      <script src="/assets/dashboard.js" defer></script>
    </AppShell>
  );
};

const Stat: FC<{ icon: 'eye' | 'check'; tone: 'blue' | 'emerald'; label: string; value: string; unit: string }> = (p) => (
  <div class="bg-slate-900 rounded-2xl p-5 shadow-xl border border-slate-800/80 flex items-center gap-4">
    <div class={`w-12 h-12 rounded-xl flex items-center justify-center border ${p.tone === 'blue' ? 'bg-blue-500/10 text-blue-400 border-blue-500/10' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10'}`}>
      <Icon name={p.icon} class="w-6 h-6" />
    </div>
    <div>
      <p class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{p.label}</p>
      <p class={`text-2xl font-bold mt-0.5 font-mono ${p.tone === 'emerald' ? 'text-emerald-400' : 'text-slate-100'}`}>
        {p.value} <span class="text-xs font-medium text-slate-500">{p.unit}</span>
      </p>
    </div>
  </div>
);

const Field: FC<{ label: string; name: string; type?: string; placeholder?: string; required?: boolean; maxlength?: number }> = (p) => (
  <div>
    <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5" for={`f-${p.name}`}>
      {p.label}
    </label>
    <input
      id={`f-${p.name}`}
      type={p.type ?? 'text'}
      name={p.name}
      required={p.required}
      maxlength={p.maxlength}
      placeholder={p.placeholder}
      class="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-xs text-slate-100 transition"
    />
  </div>
);

const TargetCard: FC<{ t: TargetRow }> = ({ t }) => (
  <div class="p-3.5 bg-slate-950 hover:bg-slate-900/60 rounded-xl border border-slate-800/60 transition-colors relative" data-target-id={String(t.id)}>
    <div class="flex justify-between items-start gap-2 pr-16">
      <div class="font-bold text-slate-200 text-xs truncate">{t.target_name}</div>
      <span class="relative flex h-1.5 w-1.5 mt-1 shrink-0">
        {!t.last_error && <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
        <span class={`relative inline-flex rounded-full h-1.5 w-1.5 ${t.last_error ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
      </span>
    </div>
    <div class="absolute top-2.5 right-2 flex gap-1">
      <button
        type="button"
        data-patrol-one={String(t.id)}
        class="text-slate-500 hover:text-indigo-300 bg-slate-900 hover:bg-indigo-500/10 border border-slate-800 p-1.5 rounded-lg transition"
        title="このLPだけ今すぐパトロール"
      >
        <Icon name="refresh" class="w-3 h-3" />
      </button>
      <form method="post" action={`/dashboard/targets/${t.id}/delete`} data-confirm="本当にこのLPの監視パトロールを終了しますか？（検知履歴も削除されます）">
        <button type="submit" class="text-slate-600 hover:text-red-400 bg-slate-900 hover:bg-red-500/10 border border-slate-800 p-1.5 rounded-lg transition" title="パトロール停止">
          <Icon name="trash" class="w-3 h-3" />
        </button>
      </form>
    </div>
    <a href={t.target_url} target="_blank" rel="noopener noreferrer" class="text-[11px] text-slate-500 hover:text-emerald-400 truncate block mt-1 transition-colors pr-6 font-mono">
      {t.target_url}
    </a>
    {t.last_error && (
      <p class="mt-2 text-[10px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1 leading-relaxed">⚠ {t.last_error}</p>
    )}
    <div class="flex justify-between items-center mt-3 pt-2 border-t border-slate-800/80 gap-2">
      <span class="text-[9px] text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded font-mono truncate max-w-[40%]">{t.selector}</span>
      <div class="flex gap-3 text-[10px] text-slate-500 text-right shrink-0">
        <span title="最終パトロール確認日時" class="inline-flex items-center gap-0.5">
          <Icon name="eye" class="w-3 h-3 text-slate-600" />
          {t.last_checked_at ? formatJst(t.last_checked_at, true) : '未確認'}
        </span>
        <span title="最後に変更を検知した日時" class="inline-flex items-center gap-0.5">
          <Icon name="edit" class="w-3 h-3 text-emerald-500" />
          {t.last_changed_at ? formatJst(t.last_changed_at, true) : '変更未検知'}
        </span>
      </div>
    </div>
  </div>
);

const TimelineItem: FC<{ h: TimelineRow; appUrl: string }> = ({ h, appUrl }) => {
  const baseline = !!h.is_baseline;
  const summary = (h.ai_summary ?? '').trim();
  const limit = 140;
  const truncated = summary.length > limit;
  const shown = truncated ? summary.slice(0, limit) + '…' : summary;
  const shareUrl = `${appUrl.replace(/\/$/, '')}/share/${h.share_token}`;
  const imp = h.ai_importance ? IMPORTANCE[h.ai_importance] : undefined;
  const tags = parseTags(h.ai_tags);

  return (
    <div class="relative pl-12 group">
      <div
        class={`absolute left-3.5 top-2 w-3 h-3 bg-slate-950 border-2 rounded-full ring-4 ring-slate-900 transition-colors ${baseline ? 'border-slate-500' : 'border-red-500 group-hover:bg-red-500'}`}
      ></div>
      <div class="p-4 border border-slate-800 rounded-2xl hover:border-emerald-500/30 bg-slate-950/40 hover:bg-slate-950/90 transition-all shadow-xl">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
          <div>
            <div class="flex flex-wrap items-center gap-1.5 mb-1.5">
              <span
                class={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border tracking-wider uppercase ${baseline ? 'bg-slate-500/10 text-slate-400 border-slate-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}
              >
                {baseline ? 'Start Watch' : 'Diff Detected'}
              </span>
              {imp && <span class={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold border ${imp.cls}`}>{imp.label}</span>}
              {!baseline && (h.added_chars > 0 || h.removed_chars > 0) && (
                <span class="text-[9px] font-mono text-slate-500">
                  <span class="text-emerald-400">+{h.added_chars}</span> / <span class="text-red-400">-{h.removed_chars}</span> 文字
                </span>
              )}
            </div>
            <h3 class="text-sm font-bold text-slate-100">{h.target_name}</h3>
          </div>
          <div class="text-[10px] font-mono font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg shrink-0 self-start">
            {formatJst(h.detected_at)}
          </div>
        </div>

        <p class="text-[11px] text-slate-500 truncate mb-4 font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800/80">{h.target_url}</p>

        {summary && (
          <div class="mb-4 bg-emerald-950/20 border border-emerald-500/20 p-3.5 rounded-xl">
            <div class="flex items-center gap-1.5 mb-2">
              <span class={`w-1.5 h-1.5 rounded-full bg-emerald-400 ${baseline ? '' : 'animate-pulse'}`}></span>
              <span class="text-xs font-bold text-emerald-400">{baseline ? 'システム通知' : 'AI サマリーレポート'}</span>
            </div>
            <p class="text-[11px] text-slate-300 leading-relaxed break-words whitespace-pre-line">
              {shown}
              {truncated && (
                <a href={`/share/${h.share_token}`} target="_blank" class="text-emerald-400 hover:text-emerald-300 hover:underline font-bold ml-1 inline-flex items-center gap-0.5">
                  続きを読む
                  <Icon name="chev-right" class="w-3 h-3" />
                </a>
              )}
            </p>
            {tags.length > 0 && (
              <div class="flex flex-wrap gap-1.5 mt-2.5">
                {tags.map((t) => (
                  <span class="text-[10px] border border-slate-700 bg-slate-900 text-slate-400 px-2 py-0.5 rounded-md">{t}</span>
                ))}
              </div>
            )}
          </div>
        )}

        <div class="bg-emerald-500/[0.02] p-3 rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between border border-emerald-500/10 gap-3">
          <div class="text-xs text-slate-400 truncate flex items-center gap-2">
            {baseline ? (
              <>
                <div class="w-1.5 h-1.5 rounded-full bg-slate-500"></div>
                ステータス:
                <span class="font-mono text-slate-400 font-bold bg-slate-900/60 px-1.5 py-0.5 border border-slate-800 rounded">データ蓄積待ち...</span>
              </>
            ) : (
              <>
                <div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                共有URL:
                <span class="font-mono text-emerald-400 font-bold bg-slate-900/60 px-1.5 py-0.5 border border-slate-800 rounded truncate">/share/{h.share_token}</span>
              </>
            )}
          </div>
          <div class="flex gap-2 shrink-0">
            {baseline ? (
              <a href={`/share/${h.share_token}`} target="_blank" class="flex-1 sm:flex-none text-xs font-bold bg-slate-900/50 border border-slate-800 text-slate-400 hover:text-white py-2 px-3 rounded-xl transition text-center">
                基準データを見る
              </a>
            ) : (
              <>
                <a href={`/share/${h.share_token}`} target="_blank" class="flex-1 sm:flex-none text-xs font-bold bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 py-2 px-3 rounded-xl transition text-center">
                  詳細ビュー
                </a>
                <button
                  type="button"
                  data-copy={shareUrl}
                  class="flex-1 sm:flex-none text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 py-2 px-3 rounded-xl shadow-lg shadow-emerald-500/10 transition flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Icon name="copy" class="w-3.5 h-3.5" />
                  コピー
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PageLink: FC<{ enabled: boolean; href: string; dir: 'prev' | 'next'; n: number }> = (p) => {
  const label = p.dir === 'prev' ? `前の${p.n}件` : `次の${p.n}件`;
  const inner = (
    <>
      {p.dir === 'prev' && <Icon name="chev-left" class="w-3.5 h-3.5" />}
      {label}
      {p.dir === 'next' && <Icon name="chev-right" class="w-3.5 h-3.5" />}
    </>
  );
  return p.enabled ? (
    <a href={p.href} class="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 hover:bg-slate-800 transition flex items-center gap-1">
      {inner}
    </a>
  ) : (
    <span class="px-3 py-1.5 bg-slate-950/50 border border-slate-800/50 rounded-lg text-xs font-bold text-slate-600 cursor-not-allowed flex items-center gap-1">{inner}</span>
  );
};
