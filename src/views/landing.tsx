import type { FC } from 'hono/jsx';
import { raw } from 'hono/html';
import { Layout } from './layout';

const DESC =
  '他社LPの価格改定、キャンペーン切り替え、キャッチコピーの裏修正を24時間自動パトロール。AIが変更内容とマーケ戦略への影響を瞬時にサマリー。ログイン不要のスマートな「差分レポートURL」で、チームやクライアントへの報告は1秒で完了。マーケター特化型の変更検知インテリジェンスSaaS。';
const TITLE = 'PageScope - 競合LPの差分調査を自動化・AIが変更点を秒速サマリー';
const SHORT = '他社LPの価格改定やキャッチコピー裏修正を逃さず検知し、AIが自動要約。マーケター特化型の変更検知SaaS。';

const SearchLogo: FC<{ big?: boolean }> = ({ big }) => (
  <div
    class={`${big ? 'w-12 h-12 rounded-xl -rotate-3' : 'w-8 h-8 rounded-lg group-hover:rotate-6'} bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 transform transition duration-300`}
  >
    <svg class={big ? 'w-6 h-6 text-slate-950' : 'w-4 h-4 text-slate-950'} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  </div>
);

const Brand: FC<{ big?: boolean }> = ({ big }) => (
  <span class={`font-logo ${big ? 'text-3xl sm:text-4xl' : 'text-xl'} font-extrabold tracking-tight text-white`}>
    PageScope<span class="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">.online</span>
  </span>
);

export const LandingPage: FC<{ appUrl: string; allowSignup: boolean; formspreeId: string; loggedIn: boolean; sent?: boolean }> = (p) => {
  const signupHref = p.allowSignup ? '/signup' : '#contact';
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'PageScope',
    operatingSystem: 'Web',
    applicationCategory: 'BusinessApplication',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
    description: '他社LPの価格改定、キャンペーン切り替え、キャッチコピーの裏修正を24時間自動パトロール。AIが変更内容とマーケ戦略への影響を瞬時にサマリー。',
    url: p.appUrl + '/',
  };

  return (
    <Layout
      title={TITLE}
      bodyClass="bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-white"
      head={
        <>
          <meta name="description" content={DESC} />
          <link rel="canonical" href={p.appUrl + '/'} />
          <meta property="og:site_name" content="PageScope" />
          <meta property="og:title" content={TITLE} />
          <meta property="og:description" content={SHORT} />
          <meta property="og:url" content={p.appUrl + '/'} />
          <meta property="og:type" content="website" />
          <meta property="og:image" content={p.appUrl + '/ogp.png'} />
          <meta property="og:locale" content="ja_JP" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={TITLE} />
          <meta name="twitter:description" content={SHORT} />
          <meta name="twitter:image" content={p.appUrl + '/ogp.png'} />
          <script type="application/ld+json">{raw(JSON.stringify(ld).replace(/</g, '\\u003c'))}</script>
        </>
      }
    >
      <nav class="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="flex justify-between h-16 items-center">
            <a href="/" class="flex items-center space-x-2 select-none group">
              <SearchLogo />
              <Brand />
            </a>
            <div class="flex items-center space-x-4 sm:space-x-6">
              <a href="#features" class="text-xs sm:text-sm text-slate-400 hover:text-slate-200 transition hidden sm:inline">機能</a>
              <a href="#usecase" class="text-xs sm:text-sm text-slate-400 hover:text-slate-200 transition hidden md:inline-block">活用シーン</a>
              <a href="#pricing" class="text-xs sm:text-sm text-slate-400 hover:text-slate-200 transition">料金</a>
              <a href="#contact" class="text-xs sm:text-sm text-slate-400 hover:text-slate-200 transition hidden md:inline-block">お問い合わせ</a>
              {p.loggedIn ? (
                <a href="/dashboard" class="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-bold py-1.5 px-3 sm:py-2 sm:px-4 rounded-xl transition shadow-md">ダッシュボード</a>
              ) : (
                <>
                  <a href="/login" class="text-xs sm:text-sm text-slate-300 hover:text-white transition">ログイン</a>
                  <a href={signupHref} class="bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-bold py-1.5 px-3 sm:py-2 sm:px-4 rounded-xl transition shadow-md">
                    {p.allowSignup ? '無料登録' : '利用申し込み'}
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <header class="relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 py-20 lg:py-32">
        <div class="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40"></div>
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div class="lg:col-span-7 text-center lg:text-left space-y-6">
              <div class="flex items-center justify-center lg:justify-start space-x-3 select-none mb-4">
                <SearchLogo big />
                <Brand big />
              </div>
              <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                AI搭載・競合インテリジェンスSaaS
              </span>
              <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
                競合LPのサイレント修正を
                <br />
                <span class="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">AIが自動で差分調査・要約</span>
              </h1>
              <p class="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                他社の価格改定、ゲリラキャンペーン、キャッチコピーの裏修正を24時間自動検知。
                <br />
                膨大なソースコードの変更点から<strong class="text-emerald-400">「何がどう変わったか」をAIが即座にサマリー。</strong>
                ログイン不要のレポート共有URLで、クライアントやチームへの報告負担をゼロにします。
              </p>
              <div class="flex flex-col sm:flex-row justify-center lg:justify-start gap-4 pt-4">
                <a href={signupHref} class="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3.5 px-8 rounded-xl transition shadow-lg shadow-emerald-500/20 text-center text-sm">
                  今すぐ無料で差分調査を自動化する
                </a>
                <a href="#pricing" class="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold py-3.5 px-8 rounded-xl transition text-center text-sm">
                  料金プランを見る
                </a>
              </div>
              <div class="text-center lg:text-left pt-2">
                <a href="/share/demo-token" target="_blank" class="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition underline decoration-emerald-500/30 underline-offset-4 font-medium">
                  💡 AIサマリー付きの実際のサンプルレポートはこちら ➔
                </a>
              </div>
            </div>

            <div class="lg:col-span-5 text-center">
              <a href="/share/demo-token" target="_blank" class="relative group block text-left mx-auto max-w-md lg:max-w-none">
                <div class="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-2xl blur-lg opacity-30 group-hover:opacity-60 transition duration-500"></div>
                <div class="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden transform transition duration-500 group-hover:scale-[1.02]">
                  <div class="flex items-center space-x-2 border-b border-slate-800 bg-slate-950/80 px-4 py-3 text-xs text-slate-500 font-mono">
                    <span class="w-3 h-3 rounded-full bg-red-500/50"></span>
                    <span class="w-3 h-3 rounded-full bg-yellow-500/50"></span>
                    <span class="w-3 h-3 rounded-full bg-green-500/50"></span>
                    <span class="ml-4 truncate text-slate-400 bg-slate-900 border border-slate-800 px-3 py-1 rounded-md flex-1 text-center">pagescope.online/share/demo-token</span>
                  </div>
                  <div class="p-6 space-y-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 to-slate-950">
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full flex items-center gap-1.5 uppercase tracking-wider">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        AI Intelligence Report
                      </span>
                      <span class="text-[10px] text-slate-500 font-mono">Just now</span>
                    </div>
                    <div>
                      <h3 class="text-sm font-bold text-white">【デモ】A社 春の特別キャンペーンLP</h3>
                      <p class="text-xs text-slate-500 font-mono mt-1">https://competitor-example.com/campaign/spring/</p>
                    </div>
                    <div class="bg-emerald-950/30 border border-emerald-500/30 p-3 rounded-xl text-[11px] space-y-1">
                      <span class="text-emerald-400 font-bold flex items-center gap-1">✨ AIによる差分サマリー</span>
                      <p class="text-slate-300 leading-relaxed">
                        競合は価格を<span class="text-emerald-300 font-bold">700円値上げ</span>した一方、CVR低下を防ぐため、特典に
                        <span class="text-emerald-300 font-bold">「Amazonギフト券3,000円分」</span>をゲリラ追加。実質的なオファー強化に舵を切っています。
                      </p>
                    </div>
                    <div class="grid grid-cols-2 gap-3 text-[10px] font-medium leading-relaxed">
                      <div class="bg-slate-900 p-3 rounded-xl border border-slate-800 text-slate-400 opacity-60">
                        <span class="text-red-400 font-bold block mb-1 border-b border-slate-800 pb-1">🔴 Before</span>
                        通常プラン：月額 9,800円
                        <br />
                        初期費用：無料
                        <br />
                        ※初月無料特典つき
                      </div>
                      <div class="bg-emerald-950/10 p-3 rounded-xl border border-emerald-900/40 text-slate-200">
                        <span class="text-emerald-400 font-bold block mb-1 border-b border-emerald-900/40 pb-1">🟢 After</span>
                        通常プラン：月額 <span class="text-emerald-300 bg-emerald-500/20 px-1 rounded">10,500円</span>
                        <br />
                        初期費用：無料
                        <br />※<span class="text-emerald-300 bg-emerald-500/20 px-1 rounded font-bold">Amazonギフト券3,000円分...</span>
                      </div>
                    </div>
                  </div>
                  <div class="absolute inset-0 bg-slate-950/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-[2px]">
                    <span class="bg-emerald-500 text-slate-950 font-bold py-3 px-6 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.4)] flex items-center gap-2 text-sm">
                      AIサマリーの爆速調査を体感する
                    </span>
                  </div>
                </div>
              </a>
              <p class="text-slate-500 text-xs mt-3 font-medium">👆 画像をクリックすると、実際のAI変更検知デモ画面を確認できます。</p>
            </div>
          </div>
        </div>
      </header>

      <section id="features" class="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-900">
        <div class="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 class="text-2xl sm:text-3xl font-bold tracking-tight text-white">なぜ、単なる「変更通知」ではダメなのか？</h2>
          <p class="text-sm text-slate-400">大量のソースコードの山から差分を探す時間はもう不要。プロのマーケターのために設計された差分インテリジェンスです。</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Feature n="①" title="AIによる「一瞬」の差分サマリー">
            変更点をAIが即座に解析。「競合がどう戦略を変えたか」の要約と重要度・次の一手を自動生成するため、一目で変更の本質が理解できます。
          </Feature>
          <Feature n="②" title="特定エリアのピンポイント監視">
            CSSセレクタ指定に対応。動的な口コミやフッターのノイズを除外し、メインコピー、価格表、オファー部分だけを狙い撃ち調査できます。
          </Feature>
          <Feature n="③" title="ログイン不要の1秒共有URL">
            検知したAIサマリーとビフォーアフターのレポートを公開リンクに。Slackへの自動通知にも対応し、貼るだけで競合調査報告が完了します。
          </Feature>
        </div>
      </section>

      <section id="usecase" class="py-20 bg-slate-900/40 border-t border-slate-900">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 class="text-2xl sm:text-3xl font-bold text-white">「気づかなかった」による広告損失を防ぐ</h2>
            <p class="text-sm text-slate-400">日常的な競合調査、クライアントワークの現場をAI差分インテリジェンスが変革します。</p>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <UseCase n="01" title="広告代理店・コンサルタント">
              「競合LPの訴求や価格が変わったこと」を泥臭く手動確認する手間をゼロに。CPA高騰の予兆をいち早くキャッチ。AIがまとめた差分サマリーURLをそのままクライアントに送り、「一歩先行く競合インテリジェンス」として圧倒的な信頼を獲得。
            </UseCase>
            <UseCase n="02" title="インハウスマーケター（自社サービス）">
              週末や深夜のゲリラ的な「限定オファー変更」や「キャッチコピーの裏修正」も完全マーク。AIが変更の意図まで要約してくれるため、自社のオファー調整やカウンター施策を、後手に回ることなく即座に打ち出せます。
            </UseCase>
          </div>
        </div>
      </section>

      <section id="pricing" class="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-900">
        <div class="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 class="text-3xl font-bold tracking-tight text-white">シンプルで透明な料金プラン</h2>
          <p class="text-sm text-slate-400">社内への稟議や経費精算がスムーズな「銀行振込（請求書払い）」に完全対応しております。</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          <PriceCard
            name="スタートプラン"
            catch="まずは自動検知を試したいマーケターへ"
            price="¥4,800"
            items={[['監視対象：1ドメイン'], ['自動パトロール：1日1回'], ['手動での即時パトロール対応'], ['ログイン不要のレポート共有']]}
            cta="無料で始める"
            href={signupHref}
          />
          <PriceCard
            popular
            name="ライトプラン"
            catch="主要な競合の動向をAIで完全マーク"
            price="¥9,800"
            items={[['監視対象：5ドメイン', true], ['AI自動サマリー機能搭載', true], ['ビジュアル・アーカイブ（スクショ自動保存）', true], ['自動パトロール：1時間に1回'], ['手動での即時パトロール対応', true], ['請求書払い（銀行振込）対応']]}
            cta="このプランを問い合わせる"
            href="#contact"
          />
          <PriceCard
            name="ビジネスプラン"
            catch="複数クライアントを抱える広告代理店へ"
            price="¥29,800"
            items={[['監視対象：30ドメイン', true], ['AI自動サマリー機能搭載', true], ['ビジュアル・アーカイブ（スクショ自動保存）', true], ['自動パトロール：10分ごと'], ['手動での即時パトロール対応', true], ['Slack への自動通知', true], ['請求書払い（銀行振込）対応']]}
            cta="このプランを問い合わせる"
            href="#contact"
          />
        </div>

        <div class="mt-16 max-w-3xl mx-auto bg-slate-900/30 border border-slate-800 p-6 sm:p-8 rounded-2xl space-y-4">
          <h3 class="text-lg font-bold text-white text-center">🏢 法人契約・請求書払い（銀行振込）の流れ</h3>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center text-xs pt-2">
            <Step n="1. お問い合わせ">下部のフォームより希望プランをご送信ください。</Step>
            <Step n="2. 請求書の発行">PDFの請求書をメールにて速やかに送付いたします。</Step>
            <Step n="3. 上限開放">お振込み確認後、即時監視上限をアップグレードします。</Step>
          </div>
          <p class="text-[11px] text-slate-500 text-center leading-relaxed pt-2">
            ※有料プランは3ヶ月または1年単位での前払いとなります。秘密保持契約（NDA）等の締結や、指定の請求書フォーマットでの発行をご希望の場合も、お問い合わせ時にお気軽にご相談ください。
          </p>
        </div>
      </section>

      <section id="faq" class="py-20 max-w-4xl mx-auto px-4 sm:px-6 border-t border-slate-900">
        <div class="text-center mb-16 space-y-4">
          <h2 class="text-2xl sm:text-3xl font-bold text-white">よくある質問</h2>
          <p class="text-sm text-slate-400">導入にあたって不安な点はこちらをご確認ください。</p>
        </div>
        <div class="space-y-6">
          <Faq q="登録すれば本当にすぐ無料で使えますか？">
            はい、メールアドレスとパスワードを設定するだけで、クレジットカード不要でフリープランをご利用いただけます。自動パトロール（1日1回）に加え、ダッシュボードからボタン1つで任意のタイミングで即時パトロールを実行することも可能です。
          </Faq>
          <Faq q="AIサマリー機能はどのような内容を出力しますか？">
            変更前後のテキストを比較し、単に「テキストが変更された」だけでなく、「価格が〇〇円高くなった」「〇〇の特典が追加された」など、マーケティング視点で重要な変更と競合の意図、取るべき対抗策を自然な日本語で要約します。重要度とカテゴリタグも自動で付与されます。
          </Faq>
          <Faq q="特定のエリアだけを監視することは可能ですか？">
            可能です。監視したいエリアのCSSセレクタ（例：<code class="bg-slate-950 text-slate-300 px-1 rounded font-mono text-xs">.price-box</code> や{' '}
            <code class="bg-slate-950 text-slate-300 px-1 rounded font-mono text-xs">#main-campaign</code>）を指定することで、口コミやフッターなどのノイズを除外したピンポイントパトロールが行えます。
          </Faq>
        </div>
      </section>

      <section id="contact" class="py-20 bg-slate-900/30 border-t border-slate-900">
        <div class="max-w-2xl mx-auto px-4">
          <div class="text-center mb-8 space-y-2">
            <h2 class="text-2xl font-bold text-white">お問い合わせ・プラン変更ご相談</h2>
            <p class="text-xs text-slate-400">有料プランへのアップグレードや法人契約のご相談はこちらからご連絡ください。</p>
          </div>
          {p.sent && (
            <div class="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm rounded-xl text-center">✨ お問い合わせを受け付けました。担当者よりご連絡いたします。</div>
          )}
          <form action={`https://formspree.io/f/${p.formspreeId}`} method="post" class="space-y-5 bg-slate-950 p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-xl">
            <input type="hidden" name="_next" value={`${p.appUrl}/?sent=1#contact`} />
            <ContactField label="お名前 / 会社名" name="name" />
            <ContactField label="メールアドレス" name="email" type="email" />
            <div>
              <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1" for="c-body">お問い合わせ内容</label>
              <textarea id="c-body" name="body" rows={5} required class="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"></textarea>
            </div>
            <button type="submit" class="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-lg transition shadow-md">送信する</button>
          </form>
        </div>
      </section>

      <footer class="bg-slate-950 border-t border-slate-900 py-12 text-center">
        <div class="max-w-7xl mx-auto px-4">
          <div class="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-8 mb-8 text-sm">
            <a href="#" class="text-slate-500 hover:text-slate-300 transition">運営会社</a>
            <a href="#" class="text-slate-500 hover:text-slate-300 transition">利用規約</a>
            <a href="#" class="text-slate-500 hover:text-slate-300 transition">プライバシーポリシー</a>
            <a href="#" class="text-slate-500 hover:text-slate-300 transition">特定商取引法に基づく表記</a>
          </div>
          <p class="text-slate-600 text-xs">&copy; {new Date().getFullYear()} PageScope.online All Rights Reserved.</p>
        </div>
      </footer>
    </Layout>
  );
};

const Feature: FC<{ n: string; title: string; children?: any }> = (p) => (
  <div class="bg-slate-900/20 border border-slate-900 p-8 rounded-2xl space-y-3">
    <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-lg">{p.n}</div>
    <h3 class="text-lg font-bold text-white">{p.title}</h3>
    <p class="text-sm text-slate-400 leading-relaxed">{p.children}</p>
  </div>
);

const UseCase: FC<{ n: string; title: string; children?: any }> = (p) => (
  <div class="bg-slate-950 p-6 sm:p-8 rounded-2xl border border-slate-800 space-y-4">
    <span class="text-xs font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded">Case {p.n}</span>
    <h3 class="text-xl font-bold text-white">{p.title}</h3>
    <p class="text-sm text-slate-400 leading-relaxed">{p.children}</p>
  </div>
);

const PriceCard: FC<{ name: string; catch: string; price: string; items: [string, boolean?][]; cta: string; href: string; popular?: boolean }> = (p) => (
  <div
    class={`p-8 rounded-2xl flex flex-col justify-between relative ${p.popular ? 'bg-slate-900/60 border-2 border-emerald-500 shadow-xl shadow-emerald-500/5' : 'bg-slate-900/20 border border-slate-800'}`}
  >
    {p.popular && (
      <span class="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-slate-950 text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full">POPULAR</span>
    )}
    <div>
      <h3 class={`text-lg font-bold ${p.popular ? 'text-white' : 'text-slate-300'}`}>{p.name}</h3>
      <p class={`text-xs mt-1 ${p.popular ? 'text-emerald-400' : 'text-slate-500'}`}>{p.catch}</p>
      <div class="mt-4 mb-6">
        <span class="text-3xl font-black text-white">{p.price}</span>
        <span class="text-xs text-slate-500"> /月 (税別)</span>
      </div>
      <ul class="space-y-3 text-sm text-slate-400 border-t border-slate-800 pt-4">
        {p.items.map(([t, hl]) => (
          <li class={`flex items-center ${hl ? 'text-emerald-400' : p.popular ? 'text-slate-300' : ''}`}>✓ {t}</li>
        ))}
      </ul>
    </div>
    <a
      href={p.href}
      class={`mt-8 block w-full py-2.5 px-4 rounded-xl text-center text-sm transition ${p.popular ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow-lg' : 'bg-slate-800 hover:bg-slate-700 text-white font-semibold'}`}
    >
      {p.cta}
    </a>
  </div>
);

const Step: FC<{ n: string; children?: any }> = (p) => (
  <div class="bg-slate-950 p-4 rounded-xl border border-slate-900">
    <span class="block font-bold text-emerald-400 mb-1">{p.n}</span>
    {p.children}
  </div>
);

const Faq: FC<{ q: string; children?: any }> = (p) => (
  <div class="bg-slate-900/20 border border-slate-900 p-6 rounded-xl space-y-2">
    <h3 class="font-bold text-white text-sm sm:text-base flex items-start">
      <span class="text-emerald-400 mr-2">Q.</span>
      {p.q}
    </h3>
    <p class="text-slate-400 text-xs sm:text-sm pl-5 leading-relaxed">{p.children}</p>
  </div>
);

const ContactField: FC<{ label: string; name: string; type?: string }> = (p) => (
  <div>
    <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1" for={`c-${p.name}`}>{p.label}</label>
    <input id={`c-${p.name}`} type={p.type ?? 'text'} name={p.name} required class="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
  </div>
);
