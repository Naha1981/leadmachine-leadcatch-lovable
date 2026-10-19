export const TRIAL_DAYS = 7;
export const MONTHLY_PRICE_RAND = 499;
const DAY_MS = 86_400_000;

type TrialProfile = {
  trial_started_at?: string | null;
  created_at?: string | null;
  subscription_status?: string | null;
  tenant_id?: string | null;
} | null | undefined;

export type TrialState = {
  status: "trial" | "active" | "expired";
  /** Current trial day, 1-based, capped at TRIAL_DAYS. */
  day: number;
  daysLeft: number;
  locked: boolean;
};

export function getTrialState(profile: TrialProfile, now: number = Date.now()): TrialState {
  const p = profile ?? {};
  if (p.subscription_status === "active") return { status: "active", day: TRIAL_DAYS, daysLeft: 0, locked: false };
  const startRaw = p.trial_started_at ?? p.created_at;
  const start = startRaw ? new Date(startRaw).getTime() : now;
  const elapsedDays = Math.max(0, Math.floor((now - start) / DAY_MS));
  const day = Math.min(TRIAL_DAYS, elapsedDays + 1);
  const expired = elapsedDays >= TRIAL_DAYS;
  return {
    status: expired ? "expired" : "trial",
    day,
    daysLeft: Math.max(0, TRIAL_DAYS - elapsedDays),
    locked: expired,
  };
}

/** Stable, human-readable EFT reference derived from the tenant id. */
export function paymentReference(tenantId: string, existing?: string | null): string {
  if (existing) return existing;
  return `RD-${tenantId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

/** Current time for trial maths. In E2E/demo mode the day can be advanced for testing. */
export function trialNow(): number {
  if (import.meta.env["VITE_E2E_MODE"] !== "true" || typeof localStorage === "undefined") return Date.now();
  const d = Number(localStorage.getItem("revenuedesk-e2e-trial-day") ?? "1");
  return Date.now() + (Math.max(1, d) - 1) * DAY_MS;
}
