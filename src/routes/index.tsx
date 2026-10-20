import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Landing } from "./landing";

// The root URL is the public front door: anonymous visitors get the
// marketing page right here (it also lives at /landing), while
// signed-in users go straight into the product.
//
// This route also completes the Lovable OAuth round-trip: the broker
// returns to the site origin with tokens in the URL (hash or query).
// They must be consumed here, before entering the app - the instant
// client-side redirect chain would otherwise drop them and Google
// sign-in would never stick.
export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "RevenueDesk — The AI Revenue Desk for service businesses" },
      {
        name: "description",
        content:
          "Capture enquiries, qualify leads, recover missed opportunities and keep follow-up moving with an AI Revenue Desk built for South African service businesses.",
      },
      { property: "og:title", content: "RevenueDesk — The AI Revenue Desk for service businesses" },
      {
        property: "og:description",
        content:
          "Capture enquiries, qualify leads, recover missed opportunities and keep follow-up moving.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: RootEntry,
});

function RootEntry() {
  const navigate = useNavigate();
  const [anonymous, setAnonymous] = useState(false);

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
        navigate({ to: "/dashboard" });
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (data.user) {
        navigate({ to: "/dashboard" });
        return;
      }
      setAnonymous(true);
    }

    enter();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return anonymous ? <Landing /> : null;
}
