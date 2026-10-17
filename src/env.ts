export interface Env {
  DB: D1Database;
  SCREENSHOTS: R2Bucket;
  ASSETS: Fetcher;

  APP_URL: string;
  GEMINI_MODEL: string;
  PATROL_BATCH_SIZE: string;
  ALLOW_SIGNUP: string;
  MAIL_FROM: string;
  FORMSPREE_ID: string;

  // secrets
  GEMINI_API_KEY?: string;
  ADMIN_USER?: string;
  ADMIN_PASSWORD?: string;
  PAGESPEED_API_KEY?: string;
  RESEND_API_KEY?: string;

  // テスト用（通常は未設定）: 外部 API の接続先を差し替える
  GEMINI_API_BASE?: string;
  PAGESPEED_API_BASE?: string;
}

export interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  plan_type: string;
  admin_memo: string | null;
  slack_webhook_url: string | null;
  created_at: number;
}

export interface TargetRow {
  id: number;
  user_id: number;
  target_url: string;
  target_name: string;
  selector: string;
  last_content: string | null;
  last_hash: string | null;
  last_checked_at: number | null;
  last_changed_at: number | null;
  last_error: string | null;
  created_at: number;
}

export interface HistoryRow {
  id: number;
  target_id: number;
  old_content: string;
  new_content: string;
  ai_summary: string | null;
  ai_importance: string | null;
  ai_tags: string | null;
  screenshot_key: string | null;
  share_token: string;
  is_baseline: number;
  added_chars: number;
  removed_chars: number;
  detected_at: number;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    user: UserRow;
  };
};
