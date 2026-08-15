import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  CalendarDays,
  Contact as ContactIcon,
  CreditCard,
  FileText,
  Gauge,
  LogOut,
  MessageCircle,
  Plug,
  Plus,
  Search,
  Send,
  Settings,
  Upload,
  Users,
  Menu,
} from "lucide-react";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { conversationsQuery, paymentsQuery, profileQuery } from "@/lib/api";
import { cn } from "@/lib/utils";
import { initialsOf } from "@/lib/format";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/demand", label: "Demand & Content", icon: BarChart3 },
  { to: "/campaigns", label: "Campaigns", icon: Send },
  { to: "/conversations", label: "Conversations", icon: MessageCircle, badge: "conversations" },
  { to: "/payments", label: "Payments", icon: CreditCard, badge: "payments" },
  { to: "/policies", label: "Policies", icon: FileText },
  { to: "/contacts", label: "Contacts", icon: ContactIcon },
  { to: "/imports", label: "Imports", icon: Upload },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/integrations", label: "Integrations", icon: Plug },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function AuthenticatedLayout() {
  const { session, user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      void navigate({ to: "/auth", search: { redirect: pathname } });
    }
  }, [loading, session, navigate, pathname]);

  const { data: profile } = useQuery(profileQuery(user?.id));
  const { data: conversations } = useQuery({ ...conversationsQuery(), enabled: Boolean(session) });
  const { data: payments } = useQuery({ ...paymentsQuery(), enabled: Boolean(session) });

  const badges: Record<string, number> = {
    conversations: conversations?.reduce((sum, c) => sum + (c.unread_count ?? 0), 0) ?? 0,
    payments: payments?.filter((p) => p.status === "pending").length ?? 0,
  };

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const fullName = (profile?.full_name as string | undefined) || user?.email || "Team member";
  const orgName =
    ((profile as { tenants?: { name?: string } } | null)?.tenants?.name as string | undefined) ??
    "Your organisation";

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "brand-gradient fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-sidebar-border transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="px-5 py-6">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            const count = "badge" in item ? badges[item.badge as string] : 0;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-primary text-primary-foreground hover:bg-primary",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {count ? (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      active
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-sidebar-accent text-sidebar-accent-foreground",
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="m-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-4">
          <p className="text-sm font-semibold text-sidebar-foreground">
            Your revenue deserves a second life.
          </p>
          <p className="mt-1 text-xs text-sidebar-foreground/70">
            We turn lapsed customers into loyal customers.
          </p>
          <p className="mt-3 text-[11px] text-sidebar-foreground/50">
            2ndLife by NahaLabs · All rights reserved.
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-lg font-bold">Welcome back, {fullName.split(" ")[0]}</p>
            <p className="truncate text-xs text-muted-foreground">
              Here's what's happening with your revenue recovery today.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-2 text-sm font-medium xl:flex">
              <Building2 className="h-4 w-4 text-primary" />
              {orgName}
            </span>
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search customers..." className="w-52 pl-9" />
            </div>
            <Button asChild size="sm">
              <Link to="/campaigns">
                <Plus className="h-4 w-4" /> New Campaign
              </Link>
            </Button>
            <span className="hidden items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground xl:flex">
              <CalendarDays className="h-4 w-4" /> Last 7 days
            </span>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {initialsOf(fullName)}
              </span>
              <div className="hidden leading-tight sm:block">
                <p className="text-sm font-semibold">{fullName}</p>
                <p className="text-xs text-muted-foreground">Administrator</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Sign out"
                onClick={async () => {
                  await signOut();
                  void navigate({ to: "/auth", search: { redirect: undefined } });
                }}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 lg:px-6">
          <Outlet />
        </main>
      </div>

      {mobileOpen ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
    </div>
  );
}

export { Users };