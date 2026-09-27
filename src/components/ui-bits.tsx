import type { ReactNode } from "react";

export const LEAD_STATUSES = ["new", "replied", "qualified", "closed"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

const STATUS_STYLE: Record<string, string> = {
  new: "bg-primary/15 text-primary",
  replied: "bg-secondary text-secondary-foreground",
  qualified: "bg-warning/15 text-warning",
  closed: "bg-muted text-muted-foreground",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_STYLE[status] ?? STATUS_STYLE["closed"]}`}>
      {status}
    </span>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string | undefined; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-card p-5 shadow-soft ${className}`}>{children}</div>;
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

export function displayPhone(p: string) {
  return p.startsWith("27") ? `+27 ${p.slice(2, 4)} ${p.slice(4, 7)} ${p.slice(7)}` : `+${p}`;
}
