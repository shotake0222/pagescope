/**
 * プラン定義（監視上限・パトロール間隔・機能）。
 * 値は旧 PHP 版（dashboard.php / patrol.php）の挙動をそのまま引き継いでいます。
 * LP の料金表と揃えたい場合はここだけ変更してください。
 */
export type PlanId = 'free' | 'light' | 'business';

export interface Plan {
  id: PlanId;
  label: string;
  maxTargets: number;
  intervalSec: number; // 自動パトロール間隔
  aiSummary: boolean;
  screenshot: boolean;
  slack: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    label: 'Free',
    maxTargets: 1,
    intervalSec: 86400,
    aiSummary: true,
    screenshot: true,
    slack: true,
  },
  light: {
    id: 'light',
    label: 'Light',
    maxTargets: 5,
    intervalSec: 3600,
    aiSummary: true,
    screenshot: true,
    slack: true,
  },
  business: {
    id: 'business',
    label: 'Business',
    maxTargets: 30,
    intervalSec: 600,
    aiSummary: true,
    screenshot: true,
    slack: true,
  },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export function getPlan(planType: string | null | undefined): Plan {
  const key = String(planType ?? 'free').trim().toLowerCase() as PlanId;
  return PLANS[key] ?? PLANS.free;
}

/** 手動の即時パトロールで、同じ対象を連続実行できる最短間隔（秒） */
export const MANUAL_PATROL_COOLDOWN_SEC = 60;

export function describeInterval(sec: number): string {
  if (sec >= 86400) return `${Math.round(sec / 86400)}日に1回`;
  if (sec >= 3600) return `${Math.round(sec / 3600)}時間に1回`;
  return `${Math.round(sec / 60)}分ごと`;
}
