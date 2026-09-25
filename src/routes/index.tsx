import { createFileRoute, Link } from "@tanstack/react-router";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "LeadCatch SA — Never miss a WhatsApp lead again" },
      {
        name: "description",
        content:
          "Instant WhatsApp lead capture and auto-reply for South African plumbers, electricians, clinics and salons.",
      },
      { property: "og:title", content: "LeadCatch SA" },
      { property: "og:description", content: "Never miss a WhatsApp lead again." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const { session } = useAuth();
  return (
    <main className="flex min-h-screen flex-col bg-background px-6">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between py-5">
        <Logo />
        {session ? null : (
          <Link to="/auth" search={{ redirect: undefined }} className="text-sm text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
        )}
      </header>
      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center pb-24">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">LeadCatch SA</h1>
        <p className="mt-3 text-lg text-muted-foreground">Never miss a WhatsApp lead again.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to={session ? "/dashboard" : "/auth"} search={session ? undefined : { redirect: "/dashboard" }}>
              {session ? "Open Dashboard" : "Get Started"}
            </Link>
          </Button>
          {session ? null : (
            <Button asChild size="lg" variant="outline">
              <Link to="/auth" search={{ redirect: undefined }}>
                Sign in
              </Link>
            </Button>
          )}
        </div>
      </section>
    </main>
  );
}
