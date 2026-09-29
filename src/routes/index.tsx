import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "LeadMachine — Never miss another WhatsApp lead" },
      { name: "description", content: "Every WhatsApp enquiry in one inbox, answered instantly, logged cleanly." },
      { property: "og:title", content: "LeadMachine" },
      { property: "og:description", content: "Every WhatsApp enquiry in one inbox, answered instantly, logged cleanly." },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/dashboard" : "/auth" });
  },
});
