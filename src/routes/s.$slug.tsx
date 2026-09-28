import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { MessageCircle, CheckCircle2 } from "lucide-react";
import { getPublicSite } from "@/lib/sites.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/s/$slug")({
  loader: async ({ params }) => {
    const site = await getPublicSite({ data: { slug: params.slug } });
    if (!site) throw notFound();
    return { site };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Page not found" }, { name: "robots", content: "noindex" }] };
    const { headline, subheadline } = loaderData.site;
    return {
      meta: [
        { title: headline || "Business page" },
        { name: "description", content: subheadline.slice(0, 160) },
        { property: "og:title", content: headline },
        { property: "og:description", content: subheadline.slice(0, 160) },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  notFoundComponent: SiteNotFound,
  component: PublicSitePage,
});

function SiteNotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This business page isn't published.</p>
      </div>
    </div>
  );
}

function PublicSitePage() {
  const { site } = Route.useLoaderData();
  const wa = site.whatsapp_number?.replace(/\D/g, "");
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <section className="mx-auto max-w-4xl px-5 pb-14 pt-20">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{site.headline}</h1>
        {site.subheadline && <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{site.subheadline}</p>}
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#quote"><Button size="lg" className="rounded-xl">{site.cta_text || "Get a free quote"}</Button></a>
          {wa && (
            <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
              <Button size="lg" variant="outline" className="rounded-xl"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp us</Button>
            </a>
          )}
        </div>
      </section>

      {site.about && (
        <section className="mx-auto max-w-4xl px-5 py-10">
          <h2 className="text-xl font-semibold">About us</h2>
          <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{site.about}</p>
        </section>
      )}

      {site.services.length > 0 && (
        <section className="mx-auto max-w-4xl px-5 py-10">
          <h2 className="text-xl font-semibold">Services</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {site.services.map((s, i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-5">
                <h3 className="font-medium">{s.name}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {site.faqs.length > 0 && (
        <section className="mx-auto max-w-4xl px-5 py-10">
          <h2 className="text-xl font-semibold">Questions</h2>
          <div className="mt-5 space-y-3">
            {site.faqs.map((f, i) => (
              <details key={i} className="rounded-2xl border border-border bg-card p-4">
                <summary className="cursor-pointer font-medium">{f.q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <section id="quote" className="mx-auto max-w-xl px-5 py-14">
        <LeadForm slug={site.slug} cta={site.cta_text} />
      </section>
    </div>
  );
}

function LeadForm({ slug, cta }: { slug: string; cta: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consent) { setError("Please agree so we can contact you."); return; }
    setState("sending");
    try {
      const res = await fetch("/api/public/site-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name, phone, message, consent: true }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Something went wrong.");
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setState("idle");
    }
  }

  if (state === "done")
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-primary" />
        <p className="mt-3 font-medium">Thanks, we've got your details.</p>
        <p className="mt-1 text-sm text-muted-foreground">We'll be in touch on WhatsApp shortly.</p>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">{cta || "Get a free quote"}</h2>
      <Input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-11 rounded-xl" />
      <Input required maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="WhatsApp number e.g. 082 123 4567" inputMode="tel" className="h-11 rounded-xl" />
      <Textarea maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What do you need help with?" className="rounded-xl" />
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
        I agree that this business may contact me on WhatsApp about my request (POPIA).
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={state === "sending"} className="h-11 w-full rounded-xl">{state === "sending" ? "Sending…" : "Send"}</Button>
    </form>
  );
}
