import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, Inbox, MessageSquareReply, Settings, Menu, Globe, Sparkles } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { Logo } from "@/components/Logo";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/_authenticated/_shell")({
  component: Shell,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/lead-intent", label: "Lead Intent", icon: Sparkles },
  { to: "/auto-reply", label: "Auto-Reply", icon: MessageSquareReply },
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
          activeProps={{ className: "bg-sidebar-accent text-foreground font-medium" }}
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
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 md:flex">
        <div className="px-3"><Logo /></div>
        <div className="mt-8 flex-1"><NavLinks /></div>
        <div className="px-3 text-xs text-muted-foreground">
          <span className={`mr-2 inline-block h-2 w-2 rounded-full ${connected ? "bg-primary" : "bg-muted-foreground/50"}`} />
          {connected ? "WhatsApp connected" : "WhatsApp not connected"}
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:hidden">
        <Logo />
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded-xl p-2 text-muted-foreground hover:bg-accent">
          <Menu className="h-5 w-5" />
        </button>
      </header>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 border-sidebar-border bg-sidebar px-3 py-5">
          <SheetTitle className="px-3"><Logo /></SheetTitle>
          <div className="mt-8"><NavLinks onNavigate={() => setOpen(false)} /></div>
        </SheetContent>
      </Sheet>

      <main className="min-w-0 flex-1">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">Couldn't load your workspace. Refresh to try again.</div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
