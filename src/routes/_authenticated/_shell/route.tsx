import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bot,
  Ellipsis,
  Inbox,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  Globe,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { Logo } from "@/components/Logo";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/_shell")({ component: Shell });

const NAV = [
  { to: "/dashboard", label: "RevenueDesk", icon: LayoutDashboard },
  { to: "/inbox", label: "Conversations", icon: Inbox },
  { to: "/revenue-leaks", label: "Revenue Leaks", icon: ShieldAlert },
  { to: "/ai-front-desk", label: "AI Front Desk", icon: Bot },
  { to: "/insights", label: "Insights", icon: BarChart3 },
  { to: "/website", label: "Business Page", icon: Globe },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

// Primary destinations live in the mobile bottom tab bar (thumb reach).
const TABS = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/revenue-leaks", label: "Leaks", icon: ShieldAlert },
  { to: "/ai-front-desk", label: "Front Desk", icon: Bot },
] as const;

// Secondary destinations live behind the More tab's bottom sheet.
const MORE = [
  { to: "/insights", label: "Insights", icon: BarChart3, blurb: "Patterns across your leads and conversations" },
  { to: "/website", label: "Business Page", icon: Globe, blurb: "Your public page and what it captures" },
  { to: "/settings", label: "Settings", icon: Settings, blurb: "Hours, services, notifications, account" },
] as const;

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {NAV.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
          activeProps={{
            className:
              "flex items-center gap-3 rounded-xl bg-sidebar-accent px-3 py-2.5 text-sm font-medium text-foreground",
          }}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function Shell() {
  const { data: ws, isLoading, error } = useWorkspace();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (ws && !ws.profile.onboarded) navigate({ to: "/onboarding" });
  }, [ws, navigate]);

  const connected = ws?.profile.whatsapp_status === "connected";
  const moreActive = MORE.some(({ to }) => pathname.startsWith(to));

  return (
    <div className="min-h-dvh md:flex">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 md:flex">
        <div className="px-3"><Logo /></div>
        <div className="mt-8 flex-1">
          <p className="px-3 pb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Operate</p>
          <NavLinks />
        </div>
        <div className="border-t border-sidebar-border px-3 pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-primary" : "bg-muted-foreground/50"}`} />
            {connected ? "WhatsApp connected" : "WhatsApp not connected"}
          </div>
          <p className="mt-2 leading-5">RevenueDesk is watching the front of your business.</p>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
        <Logo />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${connected ? "bg-primary" : "bg-muted-foreground/50"}`} />
          {connected ? "WhatsApp on" : "WhatsApp off"}
        </div>
      </header>

      <main className="min-w-0 flex-1 pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading your Revenue Desk…</div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">Couldn’t load your workspace. Refresh to try again.</div>
        ) : (
          <Outlet />
        )}
      </main>

      {/* Mobile bottom tab bar - the primary app navigation. */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-5">
          {TABS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-1 py-2 text-[10px] font-medium text-muted-foreground transition-colors active:scale-95"
              activeOptions={{ exact: to === "/dashboard" }}
              activeProps={{ className: "flex flex-col items-center gap-1 py-2 text-[10px] font-medium text-primary transition-colors active:scale-95" }}
            >
              <Icon className="h-[22px] w-[22px]" strokeWidth={1.9} />
              {label}
            </Link>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            aria-label="More"
            className={`flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors active:scale-95 ${moreActive ? "text-primary" : "text-muted-foreground"}`}
          >
            <Ellipsis className="h-[22px] w-[22px]" strokeWidth={1.9} />
            More
          </button>
        </div>
      </nav>

      {/* More tab - app-style bottom sheet for secondary destinations. */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-t border-border bg-background px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-3"
        >
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-muted-foreground/30" />
          <SheetTitle className="px-2 text-sm font-semibold">More</SheetTitle>
          <nav className="mt-2 space-y-1">
            {MORE.map(({ to, label, icon: Icon, blurb }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-accent active:bg-accent"
                activeProps={{ className: "flex items-center gap-3 rounded-xl bg-accent px-2 py-3" }}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
                  <Icon className="h-5 w-5 text-foreground" strokeWidth={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{blurb}</span>
                </span>
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex items-center gap-2 border-t border-border px-2 pt-3 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-primary" : "bg-muted-foreground/50"}`} />
            {connected ? "WhatsApp connected" : "WhatsApp not connected"}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
