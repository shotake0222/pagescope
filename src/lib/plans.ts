/**
 * プラン定義
 * プランの違いは「監視できる件数」だけです。
 * AIサマリー・スクリーンショット・即時パトロール・自動パトロールの間隔は全プラン共通。
 * 料金や件数を変えるときは、ここと LP（src/views/landing.tsx の料金表）を合わせて変更してください。
 */
export type PlanId = 'start' | 'light' | 'business';

export interface Plan {
  id: PlanId;
  label: string;
  price: string; // 表示用（税別・月額）
  maxTargets: number;
}

export const PLANS: Record<PlanId, Plan> = {
  start: { id: 'start', label: 'スタート', price: '¥4,800', maxTargets: 1 },
  light: { id: 'light', label: 'ライト', price: '¥9,800', maxTargets: 5 },
  business: { id: 'business', label: 'ビジネス', price: '¥29,800', maxTargets: 30 },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

/** 全プラン共通の自動パトロール間隔（秒） */
export const PATROL_INTERVAL_SEC = 3600;

/** 旧データの 'free' など、未知のプラン名は最小のスタートプランとして扱う */
export function normalizePlanId(planType: string | null | undefined): PlanId {
  const key = String(planType ?? '').trim().toLowerCase();
  return (PLAN_IDS as string[]).includes(key) ? (key as PlanId) : 'start';
}

export function getPlan(planType: string | null | undefined): Plan {
  return PLANS[normalizePlanId(planType)];
}

/** 手動の即時パトロールで、同じ対象を連続実行できる最短間隔（秒） */
export const MANUAL_PATROL_COOLDOWN_SEC = 60;

export function describeInterval(sec: number = PATROL_INTERVAL_SEC): string {
  if (sec >= 86400) return `${Math.round(sec / 86400)}日に1回`;
  if (sec >= 3600) return `${Math.round(sec / 3600)}時間に1回`;
  return `${Math.round(sec / 60)}分ごと`;
}
