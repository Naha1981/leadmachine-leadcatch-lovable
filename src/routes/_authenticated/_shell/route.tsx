import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Bot,
  Inbox,
  LayoutDashboard,
  Menu,
  Settings,
  ShieldAlert,
  Globe,
  X,
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { Logo } from "@/components/Logo";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/_shell")({ component: Shell });

const NAV = [
  { to: "/dashboard", label: "Revenue Desk", icon: LayoutDashboard },
  { to: "/inbox", label: "Conversations", icon: Inbox },
  { to: "/revenue-leaks", label: "Revenue Leaks", icon: ShieldAlert },
  { to: "/ai-front-desk", label: "AI Front Desk", icon: Bot },
  { to: "/insights", label: "Insights", icon: BarChart3 },
  { to: "/website", label: "Business Page", icon: Globe },
  { to: "/settings", label: "Settings", icon: Settings },
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
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (ws && !ws.profile.onboarded) navigate({ to: "/onboarding" });
  }, [ws, navigate]);

  const connected = ws?.profile.whatsapp_status === "connected";

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
          <p className="mt-2 leading-5">Lead Machine is watching the front of your business.</p>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-xl p-2 text-muted-foreground hover:bg-accent">
          <Menu className="h-5 w-5" />
        </button>
      </header>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar px-3 py-5">
          <div className="flex items-center justify-between px-3">
            <SheetTitle><Logo /></SheetTitle>
            <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-1 text-muted-foreground hover:bg-accent">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-8"><NavLinks onNavigate={() => setOpen(false)} /></div>
        </SheetContent>
      </Sheet>

      <main className="min-w-0 flex-1">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading your Revenue Desk…</div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">Couldn’t load your workspace. Refresh to try again.</div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
