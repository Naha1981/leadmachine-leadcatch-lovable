import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { generateSiteCopy } from "@/lib/ai.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui-bits";
import { getIndustryExperience } from "@/lib/industry-experiences";

export const Route = createFileRoute("/_authenticated/_shell/website")({
  head: () => ({
    meta: [
      { title: "Business Page — RevenueDesk" },
      { name: "description", content: "Edit and publish your public business page with services, FAQs and a lead form." },
      { property: "og:title", content: "Business Page — RevenueDesk" },
      { property: "og:description", content: "Edit and publish your public business page with services, FAQs and a lead form." },
    ],
  }),
  component: WebsitePage,
});

type Service = { name: string; description: string };
type Faq = { q: string; a: string };
type Form = {
  slug: string; headline: string; subheadline: string; about: string; cta_text: string;
  whatsapp_number: string; published: boolean; services: Service[]; faqs: Faq[];
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

function WebsitePage() {
  const { data: ws } = useWorkspace();
  const qc = useQueryClient();
  const gen = useServerFn(generateSiteCopy);
  const [f, setF] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const experience = getIndustryExperience(ws?.profile.industry);

  const { data: site, isLoading } = useQuery({
    queryKey: ["website", ws?.tenantId],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase.from("websites").select("*").eq("tenant_id", ws!.tenantId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!ws || isLoading || f) return;
    const p = ws.profile as any;
    setF({
      slug: site?.slug ?? slugify(p.business_name || "my-business"),
      headline: site?.headline ?? p.business_name ?? "",
      subheadline: site?.subheadline ?? "",
      about: site?.about ?? "",
      cta_text: site?.cta_text || "Get a free quote on WhatsApp",
      whatsapp_number: site?.whatsapp_number ?? p.whatsapp_number ?? "",
      published: site?.published ?? false,
      services: Array.isArray(site?.services) ? (site!.services as Service[]) : [],
      faqs: Array.isArray(site?.faqs) ? (site!.faqs as Faq[]) : [],
    });
  }, [ws, site, isLoading, f]);

  if (!f || !ws) return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF({ ...f, [k]: v });

  async function generate() {
    setGenerating(true);
    try {
      const c = await gen({ data: { tone: "friendly" } });
      setF((prev) => prev && {
        ...prev, headline: c.headline, subheadline: c.subheadline, about: c.about, cta_text: c.cta_text,
        services: c.services.map((s: any) => ({ name: String(s.name ?? ""), description: String(s.description ?? "") })),
        faqs: c.faqs.map((q: any) => ({ q: String(q.q ?? ""), a: String(q.a ?? "") })),
      });
      toast.success("Draft written — review and save.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not write copy"); }
    finally { setGenerating(false); }
  }

  async function save() {
    const slug = slugify(f!.slug);
    if (slug.length < 3) { toast.error("Page address needs at least 3 letters or numbers."); return; }
    setSaving(true);
    const row = {
      tenant_id: ws!.tenantId, slug, headline: f!.headline.slice(0, 160), subheadline: f!.subheadline.slice(0, 300),
      about: f!.about.slice(0, 2000), cta_text: f!.cta_text.slice(0, 80), whatsapp_number: f!.whatsapp_number || null,
      published: f!.published,
      services: f!.services.filter((s) => s.name.trim()).slice(0, 12),
      faqs: f!.faqs.filter((q) => q.q.trim()).slice(0, 12),
      updated_at: new Date().toISOString(),
    };
    const { error } = site
      ? await supabase.from("websites").update(row).eq("id", site.id)
      : await supabase.from("websites").insert(row);
    setSaving(false);
    if (error) {
      toast.error(error.code === "23505" ? "That page address is taken. Try another." : "Could not save your page.");
      return;
    }
    setF({ ...f!, slug });
    qc.invalidateQueries({ queryKey: ["website"] });
    toast.success(f!.published ? "Saved and live." : "Saved as draft.");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-5 md:p-8">
      <PageHeader
        title={experience ? experience.label + " Customer Page" : "Business Page"}
        subtitle={experience ? "A customer-facing page built around " + experience.label.toLowerCase() + " enquiries, services and booking or quote intent." : "Your public page with services, FAQs and a quote form that drops customer enquiries into your inbox."}
        action={site?.published ? (
          <a href={`/s/${site.slug}`} target="_blank" rel="noreferrer">
            <Button variant="outline" className="rounded-xl"><ExternalLink className="mr-2 h-4 w-4" />View page</Button>
          </a>
        ) : undefined}
      />

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={f.published} onChange={(e) => set("published", e.target.checked)} />
            Published
          </label>
          <Button variant="outline" onClick={generate} disabled={generating} className="rounded-xl">
            <Sparkles className="mr-2 h-4 w-4" />{generating ? "Writing…" : "Write with AI"}
          </Button>
        </div>
        <Field label="Page address">
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>/s/</span>
            <Input value={f.slug} onChange={(e) => set("slug", e.target.value)} className="h-10 rounded-xl" maxLength={60} />
          </div>
        </Field>
        <Field label="Headline"><Input value={f.headline} onChange={(e) => set("headline", e.target.value)} maxLength={160} className="h-10 rounded-xl" /></Field>
        <Field label="Subheadline"><Textarea value={f.subheadline} onChange={(e) => set("subheadline", e.target.value)} maxLength={300} rows={2} className="rounded-xl" /></Field>
        <Field label="About"><Textarea value={f.about} onChange={(e) => set("about", e.target.value)} maxLength={2000} rows={4} className="rounded-xl" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Button text"><Input value={f.cta_text} onChange={(e) => set("cta_text", e.target.value)} maxLength={80} className="h-10 rounded-xl" /></Field>
          <Field label="WhatsApp number"><Input value={f.whatsapp_number} onChange={(e) => set("whatsapp_number", e.target.value)} maxLength={20} placeholder="27821234567" className="h-10 rounded-xl" /></Field>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Services</h2>
          <Button size="sm" variant="ghost" onClick={() => set("services", [...f.services, { name: "", description: "" }])}><Plus className="mr-1 h-4 w-4" />Add</Button>
        </div>
        {f.services.map((s, i) => (
          <div key={i} className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Input value={s.name} placeholder="Service" maxLength={80} className="h-10 rounded-xl"
                onChange={(e) => set("services", f.services.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
              <Textarea value={s.description} placeholder="Short description" maxLength={300} rows={2} className="rounded-xl"
                onChange={(e) => set("services", f.services.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove service" onClick={() => set("services", f.services.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">FAQs</h2>
          <Button size="sm" variant="ghost" onClick={() => set("faqs", [...f.faqs, { q: "", a: "" }])}><Plus className="mr-1 h-4 w-4" />Add</Button>
        </div>
        {f.faqs.map((q, i) => (
          <div key={i} className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Input value={q.q} placeholder="Question" maxLength={160} className="h-10 rounded-xl"
                onChange={(e) => set("faqs", f.faqs.map((x, j) => j === i ? { ...x, q: e.target.value } : x))} />
              <Textarea value={q.a} placeholder="Answer" maxLength={500} rows={2} className="rounded-xl"
                onChange={(e) => set("faqs", f.faqs.map((x, j) => j === i ? { ...x, a: e.target.value } : x))} />
            </div>
            <Button size="icon" variant="ghost" aria-label="Remove FAQ" onClick={() => set("faqs", f.faqs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="rounded-xl">{saving ? "Saving…" : "Save page"}</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><p className="text-xs font-medium text-muted-foreground">{label}</p>{children}</div>;
}
