import type { FC } from 'hono/jsx';
import { formatJst } from '../lib/util';
import { parseTags } from './dashboard';
import { Icon, Layout, LogoMark, Wordmark, jsonForScript } from './layout';

export interface ShareReport {
  target_name: string;
  target_url: string;
  selector: string;
  detected_at: number;
  old_content: string;
  new_content: string;
  ai_summary: string | null;
  ai_importance: string | null;
  ai_tags: string | null;
  screenshot_key: string | null;
  is_baseline: number;
  added_chars: number;
  removed_chars: number;
}

export const DEMO_REPORT: ShareReport = {
  target_name: '【デモ用】A社 春の特別キャンペーンLP',
  target_url: 'https://competitor-example.com/campaign/spring/',
  selector: '.price-box, #main-catchcopy',
  detected_at: Math.floor(Date.now() / 1000) - 15 * 60,
  old_content:
    '【期間限定】春の特別キャンペーン実施中！\n通常プラン：月額 9,800円\n初期費用：無料\n※今ならお申し込みの方全員に、初月無料の特典をお付けします。お急ぎください！',
  new_content:
    '【期間限定】春の特別キャンペーン実施中！\n通常プラン：月額 10,500円\n初期費用：無料\n※今ならお申し込みの方全員に、Amazonギフト券3,000円分をプレゼント！',
  ai_summary:
    '月額料金が9,800円から10,500円へ700円の実質値上げとなり、同時に「初月無料」特典が「Amazonギフト券3,000円分プレゼント」へ切り替わりました。\n\n戦略的意図：初月無料は解約率の高いお試し層を呼び込みやすいため、競合は獲得単価（CPA）と継続率のバランスを見直したと推測されます。ギフト券は「得した感」を残しつつ実質負担を初月売上より小さく抑えられるため、CVRを維持したまま客単価を引き上げるA/Bテストの可能性が高いです。\n\n次の一手：1. 自社の価格据え置きを「値上げしない安心感」として訴求に追加する。2. 初月無料が終わったことで流入する比較検討層向けに、乗り換え特典LPを用意する。3. 2〜4週間後に競合LPが元に戻るかを継続監視し、テスト結果を推測する。',
  ai_importance: 'high',
  ai_tags: JSON.stringify(['プライシング変更', 'オファー内容変更']),
  screenshot_key: null,
  is_baseline: 0,
  added_chars: 28,
  removed_chars: 27,
};

const IMPORTANCE: Record<string, { label: string; cls: string; dot: string }> = {
  high: { label: '重要度: 高', cls: 'border-red-900/50 bg-red-500/10 text-red-400', dot: 'bg-red-500 animate-pulse' },
  medium: { label: '重要度: 中', cls: 'border-amber-900/50 bg-amber-500/10 text-amber-400', dot: 'bg-amber-500' },
  low: { label: '重要度: 低', cls: 'border-slate-700 bg-slate-900 text-slate-400', dot: 'bg-slate-400' },
};

export const SharePage: FC<{ r: ShareReport; demo: boolean; loggedIn: boolean }> = ({ r, demo, loggedIn }) => {
  const baseline = !!r.is_baseline || !r.old_content.trim();
  const tags = parseTags(r.ai_tags);
  const imp = r.ai_importance ? IMPORTANCE[r.ai_importance] : undefined;
  const shot = r.screenshot_key ? `/screenshots/${encodeURIComponent(r.screenshot_key)}` : null;

  return (
    <Layout
      title={`PageScope 差分解析レポート - ${r.target_name}`}
      noindex
      head={
        <>
          <meta property="og:title" content={`PageScope 差分解析レポート - ${r.target_name}`} />
          <meta property="og:description" content="競合LPの変更点とAIによる戦略分析レポート" />
          <script src="/assets/diff.min.js" defer></script>
          <script src="/assets/share.js" defer></script>
        </>
      }
      bodyClass="bg-slate-950 text-slate-100 min-h-screen antialiased selection:bg-indigo-500/30 overflow-x-hidden"
    >
      {demo && (
        <div class="no-print bg-gradient-to-r from-emerald-600 to-teal-500 text-slate-950 text-xs font-bold py-2 px-4 text-center flex items-center justify-center gap-2">
          <Icon name="info" class="w-4 h-4 animate-pulse" />
          これはダミーデータを使用したデモ画面です。本番環境の機能とレポート品質を体験いただけます。
          <a href="/" class="ml-2 underline hover:text-white transition hidden sm:inline">公式サイトに戻る</a>
        </div>
      )}

      <header class="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-4 py-3 sm:px-6 shadow-lg shadow-slate-900/50 print-plain">
        <div class="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div class="flex items-center gap-3 min-w-0">
            <a href="/" class="no-print">
              <LogoMark />
            </a>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <Wordmark class="text-sm" />
                <span class="text-slate-600">/</span>
                {baseline ? (
                  <span class="text-[10px] bg-slate-500/10 text-slate-400 border border-slate-500/30 px-2 py-0.5 rounded font-mono font-bold tracking-wider uppercase">Standby</span>
                ) : (
                  <span class="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded font-mono font-bold tracking-wider uppercase flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
                    Strategy Report
                  </span>
                )}
                <span class="text-[11px] text-slate-500 font-mono">
                  {formatJst(r.detected_at)} {baseline ? '基準取得' : '検知'}
                </span>
              </div>
              <h1 class="text-sm font-bold text-slate-200 mt-0.5 flex items-center gap-2 min-w-0">
                <span class="truncate">{r.target_name || r.target_url}</span>
                <a href={r.target_url} target="_blank" rel="noopener noreferrer nofollow" class="text-slate-500 hover:text-cyan-400 transition shrink-0 no-print" title="実際のページを開く">
                  <Icon name="external" />
                </a>
              </h1>
            </div>
          </div>
          {!baseline && (
            <div class="flex flex-wrap items-center gap-2 text-[11px] font-mono shrink-0">
              <div class="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 flex items-center gap-1.5">
                <Icon name="db" class="w-3.5 h-3.5 text-slate-500" />
                監視エリア: <span class="text-slate-200 bg-slate-950 px-1.5 rounded">{r.selector}</span>
              </div>
              <div class="bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 text-emerald-400 flex items-center gap-1.5">
                変動: <span class="text-emerald-300 font-bold">+{r.added_chars}</span>
                <span class="text-red-300 font-bold">-{r.removed_chars}</span> 文字
              </div>
              <button type="button" data-print class="no-print bg-slate-800 hover:bg-slate-700 text-white font-sans font-bold px-3 py-1.5 rounded-lg border border-slate-600 transition flex items-center gap-1.5">
                <Icon name="download" class="w-3.5 h-3.5" />
                PDF化
              </button>
            </div>
          )}
        </div>
      </header>

      <main class="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 print-plain">
        {baseline ? (
          <div class="max-w-2xl mx-auto mt-8 sm:mt-12">
            <div class="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center shadow-2xl">
              <div class="w-20 h-20 bg-slate-950 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-slate-800">
                <Icon name="clock" class="w-10 h-10 text-slate-500 animate-pulse" />
              </div>
              <h2 class="text-xl font-bold text-white mb-3">現在、比較データを蓄積中です</h2>
              <p class="text-sm text-slate-400 leading-relaxed">
                このURLは監視の基準となる初回データのみが保存されています。
                <br />
                次回のパトロールで差分が検知されると、AIサマリーと変更箇所のハイライトレポートが自動で生成されます。
              </p>
              {shot && (
                <div class="mt-8 pt-8 border-t border-slate-800">
                  <h3 class="text-xs font-bold text-slate-500 mb-3 uppercase tracking-wider">初回登録時のスナップショット</h3>
                  <div class="rounded-xl overflow-hidden border border-slate-800 max-h-[300px] overflow-y-auto">
                    <img src={shot} alt="基準スナップショット" loading="lazy" class="w-full h-auto object-cover object-top opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition duration-500" />
                  </div>
                </div>
              )}
              <details class="mt-8 text-left">
                <summary class="text-xs font-bold text-slate-400 cursor-pointer hover:text-slate-200">取得したテキストを確認する（{r.new_content.length}文字）</summary>
                <pre class="mt-3 text-[12px] text-slate-400 bg-slate-950 border border-slate-800 rounded-xl p-4 max-h-80 overflow-auto whitespace-pre-wrap break-all font-sans">{r.new_content}</pre>
              </details>
              {loggedIn && (
                <a href="/dashboard" class="no-print mt-8 inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-3 px-6 rounded-xl border border-slate-700 transition">
                  ← ダッシュボードに戻る
                </a>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* AI インサイト */}
            <div class="mb-8 bg-gradient-to-r from-indigo-950/40 to-slate-900 border border-indigo-500/20 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div class="flex flex-col lg:flex-row gap-6 relative z-10">
                <div class="shrink-0 flex flex-col justify-center items-center bg-indigo-950/60 p-5 border border-indigo-500/20 rounded-2xl lg:w-64 text-center">
                  <div class="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 mb-3">
                    <Icon name="bolt" class="w-6 h-6" />
                  </div>
                  <h3 class="text-sm font-bold text-indigo-300 tracking-wider">Gemini Predictive AI</h3>
                  <p class="text-[11px] text-slate-400 mt-1">意図の分析と推奨される打ち手</p>
                  {(imp || tags.length > 0) && (
                    <div class="flex flex-wrap justify-center gap-1.5 mt-4">
                      {imp && (
                        <span class={`text-[11px] font-bold border px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${imp.cls}`}>
                          <span class={`w-1.5 h-1.5 rounded-full ${imp.dot}`}></span>
                          {imp.label}
                        </span>
                      )}
                      {tags.map((t) => (
                        <span class="text-[11px] border border-slate-700 bg-slate-900 text-slate-400 px-2.5 py-1 rounded-lg">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div class="grow min-w-0 text-sm text-slate-300 font-medium leading-loose break-words whitespace-pre-line">
                  {r.ai_summary?.trim() ? (
                    r.ai_summary
                  ) : (
                    <p class="text-slate-500 italic py-8 text-center">このプランではAIサマリーは生成されません。下の差分ハイライトをご確認ください。</p>
                  )}
                </div>
              </div>
            </div>

            {shot && (
              <div class="mb-8 bg-[#0f1423] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
                <div class="bg-slate-900/90 px-6 py-4 border-b border-slate-800">
                  <h2 class="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Icon name="camera" class="w-4 h-4 text-emerald-400" />
                    ビジュアル・アーカイブ（変更検知時のスナップショット）
                  </h2>
                </div>
                <div class="p-6 bg-slate-950/50">
                  <a href={shot} target="_blank" class="block rounded-xl overflow-hidden border border-slate-800 max-h-[400px] overflow-y-auto">
                    <img src={shot} alt="変更検知時のスナップショット" loading="lazy" class="w-full h-auto object-cover object-top" />
                  </a>
                </div>
              </div>
            )}

            <div class="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2">
              <h2 class="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Icon name="doc" class="w-4 h-4 text-slate-400" />
                テキスト差分（Side-by-Side View）
              </h2>
              <label class="no-print inline-flex items-center gap-2 text-xs text-slate-400 cursor-pointer select-none">
                <input type="checkbox" id="only-changes" class="accent-emerald-500" />
                変更箇所の周辺だけ表示
              </label>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
              <DiffPane side="left" title="削除・変更前 (Before)" count={r.old_content.length} />
              <DiffPane side="right" title="追加・最新 (After)" count={r.new_content.length} />
            </div>

            <script
              type="application/json"
              id="diff-data"
              dangerouslySetInnerHTML={{ __html: jsonForScript({ old: r.old_content, new: r.new_content }) }}
            />
          </>
        )}
      </main>

      <footer class="no-print text-center py-10 text-[11px] text-slate-600">
        🔍 LPのサイレント修正を24時間自動パトロール：
        <a href="/" class="text-emerald-500 hover:underline">PageScope</a>
      </footer>
    </Layout>
  );
};

const DiffPane: FC<{ side: 'left' | 'right'; title: string; count: number }> = ({ side, title, count }) => (
  <div
    class={`bg-[#0f1423] rounded-2xl border shadow-xl overflow-hidden flex flex-col ${side === 'left' ? 'border-slate-800' : 'border-indigo-500/20'}`}
  >
    <div class={`px-5 py-3 border-b flex items-center justify-between shrink-0 ${side === 'left' ? 'bg-slate-900/90 border-slate-800' : 'bg-indigo-950/30 border-indigo-500/20'}`}>
      <div class="flex items-center gap-2.5">
        <span class={`h-2.5 w-2.5 rounded-full ${side === 'left' ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
        <h3 class={`text-xs font-bold tracking-widest ${side === 'left' ? 'text-slate-300' : 'text-indigo-300'}`}>{title}</h3>
      </div>
      <span class="text-[10px] font-mono text-slate-500">{count} chars</span>
    </div>
    <div class="diff-scroll p-5 sm:p-6 overflow-y-auto h-[600px]" data-side={side}>
      <div id={`diff-${side}`} class={`diff-container text-[13px] sm:text-sm ${side === 'left' ? 'text-slate-500' : 'text-slate-300'}`}>
        <span class="text-slate-600">差分を計算中…</span>
      </div>
    </div>
  </div>
);
