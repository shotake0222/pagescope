# PageScope（Cloudflare 版）

競合 LP のサイレント修正を自動パトロールし、AI（Gemini）が変更点と戦略的意図を要約する SaaS です。
Xserver（PHP + MySQL + cron）で動いていた旧版を、**Cloudflare Workers** だけで動く構成に作り直しました。

| 旧版（Xserver） | Cloudflare 版 |
| --- | --- |
| PHP ファイル群（index / login / dashboard / share / admin …） | Workers 1 本（Hono + TypeScript、サーバーサイド JSX） |
| MySQL | **D1**（SQLite） |
| `public_html/screenshots/` | **R2** バケット |
| サーバーの cron → `patrol.php` | **Cron Triggers**（10分ごと、期限が来た対象だけ処理） |
| `.env` / ソース直書きのパスワード | **Secrets**（`wrangler secret put`） |
| Tailwind CDN（本番非推奨） | ビルド済み CSS を静的配信 |

```
src/
  index.tsx            エントリー（fetch: 画面/API, scheduled: 自動パトロール）
  routes/              public（LP・ログイン・共有レポート）/ app（ダッシュボード・設定）/ admin
  views/               画面（旧 PHP のデザインを踏襲）
  lib/
    patrol.ts          パトロール本体（取得 → 差分 → AI → スクショ）
    extract.ts         HTMLRewriter による監視エリア抽出（任意の CSS セレクタ対応）
    gemini.ts          Gemini 呼び出し（構造化出力・429/503 リトライ）
    screenshot.ts      PageSpeed API で撮影 → R2 保存
    auth.ts            パスワードハッシュ・セッション・CSRF・レート制限
    plans.ts           プラン定義（上限・間隔・機能）← 料金表を変えるときはここ
migrations/            D1 スキーマ
scripts/               旧 MySQL からの移行ツール
public/                favicon・OGP・クライアント JS（CSS はビルドで生成）
```

---

## 初回セットアップ

前提：Node.js 22 以上、Cloudflare アカウント。**Workers Paid プラン（月 $5）を推奨**します
（Workers の無料プランは 1 リクエストあたりの CPU 時間が 10ms のため、大きなページの解析やログイン処理が制限に掛かる場合があります）。

```bash
npm install
npx wrangler login

# 1. データベースとバケットを作成
npx wrangler d1 create pagescope          # 表示された database_id を wrangler.jsonc に貼り付け
npx wrangler r2 bucket create pagescope-screenshots

# 2. テーブル作成
npm run db:migrate:remote

# 3. 秘密情報を登録（値は対話式で入力）
npx wrangler secret put GEMINI_API_KEY      # 必須
npx wrangler secret put ADMIN_USER          # 必須（管理画面 /admin のID）
npx wrangler secret put ADMIN_PASSWORD      # 必須（12文字以上推奨）
npx wrangler secret put PAGESPEED_API_KEY   # 任意（スクショ撮影の安定化。Google Cloud で無料発行）
npx wrangler secret put RESEND_API_KEY      # 任意（パスワード再設定メール。未設定なら運営リセット運用）

# 4. デプロイ
npm run deploy
```

デプロイ後、`https://pagescope.<アカウント>.workers.dev` で動作確認できます。

### 独自ドメイン（pagescope.online）の切り替え

1. Cloudflare ダッシュボードで `pagescope.online` をサイト追加し、ドメイン業者側のネームサーバーを Cloudflare 指定のものに変更
2. `wrangler.jsonc` の `routes` のコメントを外して `npm run deploy`
3. `APP_URL`（共有 URL やメールに使用）が `https://pagescope.online` になっていることを確認

旧 URL（`/login.php`、`/dashboard.php`、`/share.php?token=…`、`/scope.php?mode=share&token=…`）は新 URL へ自動転送されるので、
既に Slack などに貼られた共有リンクもそのまま開けます。

### GitHub からの自動デプロイ

`.github/workflows/deploy.yml` 同梱済みです。GitHub リポジトリの **Settings → Secrets and variables → Actions** に以下を登録すると、
`main` への push で「型チェック → ビルド → D1 マイグレーション → デプロイ」が自動で走ります。

- `CLOUDFLARE_API_TOKEN`（テンプレート「Edit Cloudflare Workers」＋ D1 編集権限）
- `CLOUDFLARE_ACCOUNT_ID`

---

運用の手順（申し込み〜ログイン〜利用、プラン変更、パスワード再発行など）は [docs/OPERATIONS.md](docs/OPERATIONS.md) にまとめています。

---

## 旧サーバーからのデータ移行

1. `scripts/export-mysql-to-d1.php` を Xserver にアップロードし、SSH で実行（ブラウザからは実行不可）
   ```bash
   DB_HOST=mysql10050.xserver.jp DB_NAME=… DB_USER=… DB_PASS='…' php export-mysql-to-d1.php > pagescope.export.sql
   ```
2. 手元で取り込み
   ```bash
   npx wrangler d1 execute pagescope --remote --file=pagescope.export.sql
   ```
3. スクリーンショットを移す場合は `public_html/screenshots/` をダウンロードして
   ```bash
   ./scripts/upload-screenshots.sh ./screenshots
   ```

- パスワードは旧 bcrypt のまま移行され、各ユーザーの次回ログイン時に自動で新方式に切り替わります（再発行は不要）
  - ただし旧方式の照合は CPU を約 90ms 使うため、**Workers 無料プランではログインできません**。無料プランのまま移行する場合は `/admin` の「パスリセット」で再発行してください
- 移行直後の最初のパトロールは、抽出方式の違いによる誤検知を避けるため「基準の更新」だけを行い、アラートは出しません
- 旧版で平文パスワードのまま残っていたアカウントは移行後ログインできません。管理画面 `/admin` の「パスリセット」で再発行してください
- 移行が終わったら Xserver の PHP ファイル・`.env` は削除してください
- **旧ソースに書かれていた Gemini API キーと MySQL パスワードは、平文で各ファイルに入っていたため作り直しを推奨します**（Google AI Studio でキーを再発行 → `wrangler secret put GEMINI_API_KEY`）
- `void_dev.php`（VOID DEV）は別サービス・別 DB のため、この移行には含めていません

---

## ローカル開発

```bash
cp .dev.vars.example .dev.vars   # 値を記入
npm run db:migrate:local
npm run dev                      # http://localhost:8787
# 自動パトロールを手動で発火
curl "http://localhost:8787/cdn-cgi/handler/scheduled"
```

外部 API に繋がない環境でテストする場合は、`.dev.vars` に `GEMINI_API_BASE` / `PAGESPEED_API_BASE` を書くと
Gemini・PageSpeed の接続先をモックサーバーに差し替えられます（本番では設定不要）。

---

## 旧版からの主な変更点

**セキュリティ**
- DB パスワード・Gemini APIキー・管理者パスワード（`0000`）をソースから撤去し、Secrets 管理に
- ログイン画面の「メールアドレスを入れるだけで誰でもパスワードを再発行・表示できる」機能を廃止（第三者による乗っ取りが可能だったため）→ メールリンク方式／運営リセットへ
- 平文パスワードでもログインできた抜け道を廃止、ハッシュを PBKDF2-SHA256 に
- ログイン・管理画面の総当たり対策（15分10回）、CSRF 対策（同一オリジン検証＋SameSite Cookie）、HttpOnly/Secure Cookie
- `scope.php` にあった「誰でも user_id=1 としてログイン状態になる」簡易ダッシュボードを廃止

**パトロール精度**
- 監視エリア抽出を HTMLRewriter に置き換え（指定エリアの外側のテキストが混ざらないことを確認済み）、`main .price-box`、`section > h2`、`.a, .b` など一般的な CSS セレクタが使えるように
- `<script>` / `<style>` を確実に除外（旧 `patrol.php` は除外していなかったため、計測タグの変化で誤検知していた）
- Shift_JIS / EUC-JP のページに対応、画像の alt テキストも検知対象に（バナー差し替え検知）
- 空白・記号だけの変化はアラートにしない
- AI に「先頭1000文字」ではなく **変更箇所の抜粋** を渡すため、ページ後半の変更も分析されるように
- AI の出力を構造化（要約・重要度・カテゴリタグ）。Gemini 2.5 Flash の思考トークンでレポートが途中で切れる問題を解消
- 自動パトロールと手動パトロールの同時実行による二重レポートを防止
- 取得エラー（404、セレクタ不一致など）をダッシュボードに表示

**機能**
- Slack 通知（旧 `cron_crawler.php`）は廃止
- プランの違いを監視ドメイン数だけに整理（スタート 1／ライト 5／ビジネス 30、自動パトロールは全プラン1時間に1回）。無料プランは廃止
- アカウント設定画面（パスワード変更・プラン確認）
- 共有レポートの差分表示を行＋文字単位のハイライトに改善（「9,800円→10,500円」のような数字が細切れにならないよう調整）、「変更箇所の周辺だけ表示」切替、PDF 化ボタンを実装（ブラウザ印刷）
- 監視対象ごとの「今すぐパトロール」ボタン、進捗表示
- 監視対象の削除時にスクリーンショットも R2 から削除
- アカウントは運営が `/admin` で発行（LP からのセルフ登録はなし）

## 設定値（`wrangler.jsonc` の `vars`）

| 名前 | 既定値 | 内容 |
| --- | --- | --- |
| `APP_URL` | `https://pagescope.online` | 共有 URL・メールに使う公開 URL |
| `GEMINI_MODEL` | `gemini-2.5-flash` | 使用する Gemini モデル |
| `PATROL_BATCH_SIZE` | `15` | 1回の自動パトロールで処理する最大件数 |
| `PASSWORD_HASH_ITERATIONS` | `20000` | パスワードハッシュの強度。Workers Paid なら `100000` 推奨 |
| `MAIL_FROM` | `PageScope <noreply@pagescope.online>` | パスワード再設定メールの送信元（Resend で認証したドメイン） |
| `FORMSPREE_ID` | `xgaedrrr` | LP のお問い合わせフォーム送信先 |

プランの料金・監視上限、全プラン共通のパトロール間隔は `src/lib/plans.ts` で変更できます（LP の料金表にも自動で反映）。
