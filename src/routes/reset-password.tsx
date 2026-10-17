import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password — RevenueDesk" },
      { name: "description", content: "Choose a new password for your RevenueDesk account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let settled = false;

    // The recovery link carries tokens in the URL hash. The Supabase client
    // consumes them and fires PASSWORD_RECOVERY; fall back to setting the
    // session manually when the hash is still present.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        settled = true;
        setReady(true);
      }
    });

    async function recover() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (hash.get("type") === "recovery" && accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) {
          settled = true;
          window.history.replaceState(null, "", window.location.pathname);
          setReady(true);
          return;
        }
      }
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        settled = true;
        setReady(true);
        return;
      }
      setTimeout(() => {
        if (!settled) setInvalid(true);
      }, 4000);
    }

    recover();
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated. You are signed in.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-5 py-8">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <Logo />
        <h1 className="mt-10 text-2xl font-semibold tracking-tight">Set a new password</h1>
        {invalid ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">
              This reset link is invalid or has expired. Request a new one.
            </p>
            <Link to="/auth" className="mt-6">
              <Button className="h-11 w-full rounded-xl font-semibold">Back to sign in</Button>
            </Link>
          </>
        ) : ready ? (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl font-semibold">
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Checking your reset link…</p>
        )}
      </div>
    </div>
  );
}
