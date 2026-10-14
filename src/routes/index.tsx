import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// App-first: the root URL opens the product, not a marketing page.
// The marketing site lives at /landing.
//
// This route also completes the Lovable OAuth round-trip: the broker
// returns to the site origin with tokens in the URL (hash or query).
// They must be consumed here, before entering the app - the instant
// client-side redirect chain would otherwise drop them and Google
// sign-in would never stick.
export const Route = createFileRoute("/")({
  ssr: false,
  component: RootEntry,
});

function RootEntry() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function enter() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const query = new URLSearchParams(window.location.search);
      const accessToken = hash.get("access_token") ?? query.get("access_token");
      const refreshToken = hash.get("refresh_token") ?? query.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (cancelled) return;
        window.history.replaceState(null, "", window.location.pathname);
        if (error) {
          navigate({ to: "/auth" });
          return;
        }
      }
      navigate({ to: "/dashboard" });
    }

    enter();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return null;
}
