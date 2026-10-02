import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { disconnectWhatsApp } from "@/lib/whatsapp.functions";
import { getZeroUISettings, setZeroUISettings } from "@/lib/zero-ui.functions";
import type { WorkingHours } from "@/lib/autoreply";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, PageHeader, displayPhone, timeAgo } from "@/components/ui-bits";
import { HoursEditor } from "@/components/HoursEditor";
import { Switch } from "@/components/ui/switch";
import { WhatsAppConnect } from "@/components/WhatsAppConnect";

export const Route = createFileRoute("/_authenticated/_shell/settings")({
  head: () => ({
    meta: [
      { title: "Settings — LeadMachine" },
      { name: "description", content: "Business profile, working hours, WhatsApp connection and account." },
      { property: "og:title", content: "Settings — LeadMachine" },
      { property: "og:description", content: "Manage your LeadMachine settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: ws } = useWorkspace();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const disconnect = useServerFn(disconnectWhatsApp);
  const loadZeroUI = useServerFn(getZeroUISettings);
  const updateZeroUI = useServerFn(setZeroUISettings);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [alertPhone, setAlertPhone] = useState("");
  const [hours, setHours] = useState<WorkingHours | null>(null);
  const [saving, setSaving] = useState(false);
  const [zeroLoading, setZeroLoading] = useState(true);
  const [zeroSaving, setZeroSaving] = useState(false);
  const [zeroEnabled, setZeroEnabled] = useState(false);
  const [zeroAutomation, setZeroAutomation] = useState(true);
  const [zeroAutoFollowups, setZeroAutoFollowups] = useState(true);
  const [zeroWhatsAppConnected, setZeroWhatsAppConnected] = useState(false);
  const [marketEnabled, setMarketEnabled] = useState(false);
  const [marketWebsite, setMarketWebsite] = useState("");
  const [marketKeywords, setMarketKeywords] = useState("");
  const [marketCompetitors, setMarketCompetitors] = useState<Array<{ id: string; name: string; website_url: string; status: string }>>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketSaving, setMarketSaving] = useState(false);
  const [newCompetitorName, setNewCompetitorName] = useState("");
  const [newCompetitorUrl, setNewCompetitorUrl] = useState("");

  useEffect(() => {
    if (!ws) return;
    setName(ws.profile.business_name);
    setIndustry(ws.profile.industry);
    setAlertPhone(ws.profile.contact_phone ?? "");
    setHours(ws.profile.working_hours as WorkingHours);
    setMarketEnabled(Boolean(ws.profile.market_intelligence_enabled));
    setMarketWebsite(ws.profile.market_intelligence_website ?? "");
    const keywords = Array.isArray(ws.profile.market_intelligence_keywords) ? ws.profile.market_intelligence_keywords : [];
    setMarketKeywords(keywords.map(String).join(", "));
  }, [ws]);

  useEffect(() => {
    if (!ws) return;
    let active = true;
    setZeroLoading(true);
    loadZeroUI()
      .then((settings) => {
        if (!active) return;
        setZeroEnabled(settings.enabled);
        setZeroAutomation(settings.automationEnabled);
        setZeroAutoFollowups(settings.autoFollowupsEnabled);
        setZeroWhatsAppConnected(settings.whatsappConnected);
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Could not load Zero UI settings"))
      .finally(() => { if (active) setZeroLoading(false); });
    return () => { active = false; };
  }, [ws, loadZeroUI]);

  useEffect(() => {
    if (!ws) return;
    let active = true;
    setMarketLoading(true);
    supabase
      .from("market_intelligence_competitors")
      .select("id,name,website_url,status")
      .eq("tenant_id", ws.tenantId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) toast.error("Could not load competitors");
        setMarketCompetitors(data ?? []);
      })
      .finally(() => { if (active) setMarketLoading(false); });
    return () => { active = false; };
  }, [ws?.tenantId]);

  // Live status updates from the webhook/status poll.
  useEffect(() => {
    if (!ws) return;
    const ch = supabase
      .channel(`profile-${ws.tenantId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "business_profiles", filter: `tenant_id=eq.${ws.tenantId}` }, () =>
        qc.invalidateQueries({ queryKey: ["workspace"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ws, qc]);

  if (!ws || !hours) return null;
  const p = ws.profile;
  const connected = p.whatsapp_status === "connected";

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("business_profiles")
      .update({ business_name: name.trim(), industry: industry.trim(), contact_phone: alertPhone.trim(), working_hours: hours!, updated_at: new Date().toISOString() })
      .eq("tenant_id", ws!.tenantId);
    setSaving(false);
    if (error) { toast.error("Could not save"); return; }
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["workspace"] });
  }

  async function saveMarketIntelligence() {
    if (!ws) return;
    setMarketSaving(true);
    const keywords = marketKeywords.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 15);
    const { error } = await supabase
      .from("business_profiles")
      .update({
        market_intelligence_enabled: marketEnabled,
        market_intelligence_website: marketWebsite.trim() || null,
        market_intelligence_keywords: keywords,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", ws.tenantId);
    setMarketSaving(false);
    if (error) { toast.error("Could not save Market Intelligence settings"); return; }
    toast.success("Market Intelligence settings saved");
    qc.invalidateQueries({ queryKey: ["workspace"] });
  }

  async function addCompetitor() {
    if (!ws || !newCompetitorName.trim() || !newCompetitorUrl.trim()) return;
    try {
      const { data, error } = await supabase
        .from("market_intelligence_competitors")
        .insert({
          tenant_id: ws.tenantId,
          name: newCompetitorName.trim(),
          website_url: newCompetitorUrl.trim(),
          source: "manual",
          status: "active",
        })
        .select("id,name,website_url,status")
        .single();
      if (error) throw error;
      setMarketCompetitors((current) => [data, ...current]);
      setNewCompetitorName("");
      setNewCompetitorUrl("");
      toast.success("Competitor added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add competitor");
    }
  }

  async function setCompetitorStatus(id: string, status: "active" | "ignored") {
    const { error } = await supabase
      .from("market_intelligence_competitors")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", ws!.tenantId);
    if (error) { toast.error("Could not update competitor"); return; }
    setMarketCompetitors((current) => current.map((item) => item.id === id ? { ...item, status } : item));
  }

  async function deleteCompetitor(id: string) {
    const { error } = await supabase
      .from("market_intelligence_competitors")
      .delete()
      .eq("id", id)
      .eq("tenant_id", ws!.tenantId);
    if (error) { toast.error("Could not remove competitor"); return; }
    setMarketCompetitors((current) => current.filter((item) => item.id !== id));
  }

  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth" });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <PageHeader title="Settings" />

      <Card className="space-y-4">
        <h2 className="font-medium">WhatsApp</h2>
        <div className="flex items-center justify-between gap-4 text-sm">
          <div>
            <p className="flex items-center gap-2 font-medium">
              <span className={`h-2 w-2 rounded-full ${connected ? "bg-primary" : "bg-destructive"}`} />
              {connected ? "Connected" : p.whatsapp_status === "connecting" ? "Waiting for link" : "Not connected"}
            </p>
            <p className="mt-1 text-muted-foreground">
              {p.whatsapp_number ? displayPhone(p.whatsapp_number) : "No number linked"}
              {p.whatsapp_last_synced_at && ` · Last synced ${timeAgo(p.whatsapp_last_synced_at)}`}
            </p>
          </div>
          {connected && (
            <Button variant="outline" className="rounded-xl" onClick={async () => { await disconnect(); qc.invalidateQueries({ queryKey: ["workspace"] }); }}>
              Disconnect
            </Button>
          )}
        </div>
        {!connected && <WhatsAppConnect />}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-medium">Zero UI</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              WhatsApp becomes the day-to-day interface. LeadMachine can monitor leads, answer owner requests, schedule safe follow-ups and send proactive alerts without the dashboard.
            </p>
          </div>
          <Switch
            checked={zeroEnabled}
            disabled={zeroLoading || zeroSaving || !zeroWhatsAppConnected || !alertPhone.trim()}
            onCheckedChange={async (checked) => {
              setZeroSaving(true);
              try {
                const result = await updateZeroUI({ data: { enabled: checked } });
                setZeroEnabled(Boolean(result.enabled));
                toast.success(checked ? "Zero UI enabled" : "Zero UI paused");
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not update Zero UI");
              } finally {
                setZeroSaving(false);
              }
            }}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">WhatsApp</p>
            <p className="mt-1 text-sm font-semibold">{zeroWhatsAppConnected ? "Connected" : "Connect first"}</p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Automation</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">{zeroAutomation ? "Active" : "Paused"}</p>
              <Switch
                checked={zeroAutomation}
                disabled={!zeroEnabled || zeroSaving}
                onCheckedChange={async (checked) => {
                  setZeroSaving(true);
                  try {
                    await updateZeroUI({ data: { automationEnabled: checked } });
                    setZeroAutomation(checked);
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not update automation");
                  } finally {
                    setZeroSaving(false);
                  }
                }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3">
          <div>
            <p className="text-sm font-medium">Automatic follow-ups</p>
            <p className="text-xs text-muted-foreground">Owner commands can schedule eligible follow-ups; replies cancel them.</p>
          </div>
          <Switch
            checked={zeroAutoFollowups}
            disabled={!zeroEnabled || zeroSaving}
            onCheckedChange={async (checked) => {
              setZeroSaving(true);
              try {
                await updateZeroUI({ data: { autoFollowupsEnabled: checked } });
                setZeroAutoFollowups(checked);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not update follow-up setting");
              } finally {
                setZeroSaving(false);
              }
            }}
          />
        </div>
        {!zeroWhatsAppConnected && <p className="text-xs text-muted-foreground">Connect the business WhatsApp number above before enabling Zero UI.</p>}
      </Card>
      <Card className="space-y-4">
        <h2 className="font-medium">Business profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="n">Business name</Label>
            <Input id="n" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i">Industry</Label>
            <Input id="i" value={industry} onChange={(e) => setIndustry(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="alert-phone">Owner alert number</Label>
            <Input id="alert-phone" value={alertPhone} onChange={(e) => setAlertPhone(e.target.value)} placeholder="e.g. 082 123 4567" className="h-11 rounded-xl" inputMode="tel" />
            <p className="text-xs text-muted-foreground">LeadMachine uses this number for Zero UI owner commands and proactive alerts.</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Working hours</Label>
          <HoursEditor value={hours} onChange={setHours} />
        </div>
        <Button onClick={save} disabled={saving} className="h-11 rounded-xl px-5 font-semibold">{saving ? "Saving…" : "Save changes"}</Button>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-medium">Market Intelligence</h2>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Watch the market for this business</p>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              LeadMachine will use your business profile, public sources and approved competitors to build evidence-backed market findings automatically.
            </p>
          </div>
          <Switch checked={marketEnabled} onCheckedChange={setMarketEnabled} disabled={marketSaving} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mi-website">Business website</Label>
            <Input id="mi-website" value={marketWebsite} onChange={(e) => setMarketWebsite(e.target.value)} placeholder="https://example.co.za" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mi-keywords">Topics/services to watch</Label>
            <Input id="mi-keywords" value={marketKeywords} onChange={(e) => setMarketKeywords(e.target.value)} placeholder="roof repairs, waterproofing, emergency leaks" className="h-11 rounded-xl" />
            <p className="text-xs text-muted-foreground">Comma-separated terms. LeadMachine also derives searches from your industry and services.</p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Competitors</p>
            <p className="mt-1 text-xs text-muted-foreground">LeadMachine can discover competitors automatically. Add, ignore or remove specific ones here.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input value={newCompetitorName} onChange={(e) => setNewCompetitorName(e.target.value)} placeholder="Competitor name" className="h-10 rounded-xl" />
            <Input value={newCompetitorUrl} onChange={(e) => setNewCompetitorUrl(e.target.value)} placeholder="https://competitor.co.za" className="h-10 rounded-xl" />
            <Button type="button" onClick={addCompetitor} disabled={marketSaving || !newCompetitorName.trim() || !newCompetitorUrl.trim()} className="h-10 rounded-xl">Add</Button>
          </div>
          <div className="space-y-2">
            {marketLoading ? (
              <p className="text-sm text-muted-foreground">Loading competitors…</p>
            ) : marketCompetitors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No competitors added yet.</p>
            ) : marketCompetitors.map((competitor) => (
              <div key={competitor.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{competitor.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{competitor.website_url}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{competitor.status}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setCompetitorStatus(competitor.id, competitor.status === "ignored" ? "active" : "ignored")} className="rounded-xl">
                    {competitor.status === "ignored" ? "Use" : "Ignore"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => deleteCompetitor(competitor.id)} className="rounded-xl">Remove</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={saveMarketIntelligence} disabled={marketSaving} className="h-11 rounded-xl">
            {marketSaving ? "Saving…" : "Save Market Intelligence"}
          </Button>
        </div>
      </Card>

      <Card className="flex items-center justify-between gap-4">
        <div className="text-sm">
          <p className="font-medium">Account</p>
          <p className="text-muted-foreground">{ws.userEmail}</p>
        </div>
        <Button variant="outline" className="rounded-xl" onClick={signOut}>Log out</Button>
      </Card>
    </div>
  );
}
