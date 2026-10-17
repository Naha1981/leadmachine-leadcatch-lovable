import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { disconnectWhatsApp } from "@/lib/whatsapp.functions";
import { deleteMyAccount } from "@/lib/account.functions";
import { getZeroUISettings, setZeroUISettings } from "@/lib/zero-ui.functions";
import {
  getDeveloperSettings,
  createApiKey,
  revokeApiKey,
  saveWebhook,
  deleteWebhook,
} from "@/lib/developer.functions";
import { normalizeWorkingHours, type WorkingHours } from "@/lib/autoreply";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, PageHeader, displayPhone, timeAgo } from "@/components/ui-bits";
import { HoursEditor } from "@/components/HoursEditor";
import { Switch } from "@/components/ui/switch";
import { WhatsAppConnect } from "@/components/WhatsAppConnect";
import { getIndustryExperience } from "@/lib/industry-experiences";

export const Route = createFileRoute("/_authenticated/_shell/settings")({
  head: () => ({
    meta: [
      { title: "Settings — RevenueDesk" },
      {
        name: "description",
        content: "Business profile, working hours, WhatsApp connection and account.",
      },
      { property: "og:title", content: "Settings — RevenueDesk" },
      { property: "og:description", content: "Manage your RevenueDesk settings." },
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
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteAccount = useServerFn(deleteMyAccount);
  const [zeroLoading, setZeroLoading] = useState(true);
  const [zeroSaving, setZeroSaving] = useState(false);
  const [zeroEnabled, setZeroEnabled] = useState(false);
  const [zeroAutomation, setZeroAutomation] = useState(true);
  const [zeroAutoFollowups, setZeroAutoFollowups] = useState(true);
  const [zeroWhatsAppConnected, setZeroWhatsAppConnected] = useState(false);
  const [marketEnabled, setMarketEnabled] = useState(false);
  const [marketWebsite, setMarketWebsite] = useState("");
  const [marketKeywords, setMarketKeywords] = useState("");
  const [marketCompetitors, setMarketCompetitors] = useState<
    Array<{ id: string; name: string; website_url: string; status: string }>
  >([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketSaving, setMarketSaving] = useState(false);
  const [newCompetitorName, setNewCompetitorName] = useState("");
  const [newCompetitorUrl, setNewCompetitorUrl] = useState("");
  const loadDeveloper = useServerFn(getDeveloperSettings);
  const createKey = useServerFn(createApiKey);
  const revokeKey = useServerFn(revokeApiKey);
  const addWebhook = useServerFn(saveWebhook);
  const removeWebhook = useServerFn(deleteWebhook);
  const [devLoading, setDevLoading] = useState(true);
  const [devKeys, setDevKeys] = useState<Array<{ id: string; label: string; key_prefix: string; created_at: string; last_used_at: string | null }>>([]);
  const [devHooks, setDevHooks] = useState<Array<{ id: string; url: string; events: string[]; active: boolean }>>([]);
  const [devDeliveries, setDevDeliveries] = useState<Array<{ id: string; event: string; status: number | null; ok: boolean | null; error: string | null; attempted_at: string }>>([]);
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newHookUrl, setNewHookUrl] = useState("");
  const [newHookSecret, setNewHookSecret] = useState("");
  const [devSaving, setDevSaving] = useState(false);
  const experience = getIndustryExperience(industry);

  useEffect(() => {
    if (!ws) return;
    setName(ws.profile.business_name);
    setIndustry(ws.profile.industry);
    setAlertPhone(ws.profile.contact_phone ?? "");
    setHours(normalizeWorkingHours(ws.profile.working_hours));
    setMarketEnabled(Boolean(ws.profile.market_intelligence_enabled));
    setMarketWebsite(ws.profile.market_intelligence_website ?? "");
    const keywords = Array.isArray(ws.profile.market_intelligence_keywords)
      ? ws.profile.market_intelligence_keywords
      : [];
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
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : "Could not load Zero UI settings"),
      )
      .finally(() => {
        if (active) setZeroLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ws, loadZeroUI]);

  useEffect(() => {
    if (!ws) return;
    let active = true;
    setMarketLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("market_intelligence_competitors")
          .select("id,name,website_url,status")
          .eq("tenant_id", ws.tenantId)
          .order("created_at", { ascending: false });
        if (!active) return;
        if (error) toast.error("Could not load competitors");
        setMarketCompetitors(data ?? []);
      } catch (error) {
        if (active)
          toast.error(error instanceof Error ? error.message : "Could not load competitors");
      } finally {
        if (active) setMarketLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [ws?.tenantId]);

  useEffect(() => {
    if (!ws) return;
    let active = true;
    setDevLoading(true);
    loadDeveloper()
      .then((d) => {
        if (!active) return;
        setDevKeys(d.apiKeys);
        setDevHooks(d.webhooks);
        setDevDeliveries(d.deliveries);
      })
      .catch(() => {
        if (active) toast.error("Could not load developer settings");
      })
      .finally(() => {
        if (active) setDevLoading(false);
      });
    return () => {
      active = false;
    };
  }, [ws, loadDeveloper]);

  // Live status updates from the webhook/status poll.
  useEffect(() => {
    if (!ws) return;
    const ch = supabase
      .channel(`profile-${ws.tenantId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "business_profiles",
          filter: `tenant_id=eq.${ws.tenantId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["workspace"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [ws, qc]);

  if (!ws || !hours) return null;
  const p = ws.profile;
  const connected = p.whatsapp_status === "connected";

  async function refreshDeveloper() {
    const d = await loadDeveloper();
    setDevKeys(d.apiKeys);
    setDevHooks(d.webhooks);
    setDevDeliveries(d.deliveries);
  }

  async function onCreateKey() {
    setDevSaving(true);
    try {
      const { key } = await createKey({ data: { label: newKeyLabel } });
      setNewKeyValue(key);
      setNewKeyLabel("");
      toast.success("API key created");
      await refreshDeveloper();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create API key");
    } finally {
      setDevSaving(false);
    }
  }

  async function onRevokeKey(id: string) {
    try {
      await revokeKey({ data: { id } });
      toast.success("API key revoked");
      await refreshDeveloper();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke API key");
    }
  }

  async function onAddWebhook() {
    setDevSaving(true);
    try {
      const { secret } = await addWebhook({ data: { url: newHookUrl, events: ["lead.created"] } });
      setNewHookSecret(secret);
      setNewHookUrl("");
      toast.success("Webhook added");
      await refreshDeveloper();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add webhook");
    } finally {
      setDevSaving(false);
    }
  }

  async function onDeleteWebhook(id: string) {
    try {
      await removeWebhook({ data: { id } });
      toast.success("Webhook removed");
      await refreshDeveloper();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove webhook");
    }
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("business_profiles")
      .update({
        business_name: name.trim(),
        industry: industry.trim(),
        contact_phone: alertPhone.trim(),
        working_hours: hours!,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", ws!.tenantId);
    setSaving(false);
    if (error) {
      toast.error("Could not save");
      return;
    }
    toast.success("Settings saved");
    qc.invalidateQueries({ queryKey: ["workspace"] });
  }

  async function saveMarketIntelligence() {
    if (!ws) return;
    setMarketSaving(true);
    const keywords = marketKeywords
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 15);
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
    if (error) {
      toast.error("Could not save Market Intelligence settings");
      return;
    }
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
    if (error) {
      toast.error("Could not update competitor");
      return;
    }
    setMarketCompetitors((current) =>
      current.map((item) => (item.id === id ? { ...item, status } : item)),
    );
  }

  async function deleteCompetitor(id: string) {
    const { error } = await supabase
      .from("market_intelligence_competitors")
      .delete()
      .eq("id", id)
      .eq("tenant_id", ws!.tenantId);
    if (error) {
      toast.error("Could not remove competitor");
      return;
    }
    setMarketCompetitors((current) => current.filter((item) => item.id !== id));
  }

  async function deleteAccountForever() {
    setDeleting(true);
    try {
      await deleteAccount();
      await supabase.auth.signOut();
      toast.success("Your account and data have been deleted.");
      navigate({ to: "/auth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the account");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth" });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 md:px-8 md:py-10">
      <PageHeader
        title={experience ? experience.label + " RevenueDesk Settings" : "RevenueDesk Settings"}
        subtitle={
          experience
            ? "Control the rules, services and customer-handling behaviour RevenueDesk uses for " +
              experience.label.toLowerCase() +
              " enquiries."
            : "Control your business profile, customer-handling rules and channels."
        }
      />

      <Card className="space-y-4">
        <h2 className="font-medium">WhatsApp</h2>
        <div className="flex items-center justify-between gap-4 text-sm">
          <div>
            <p className="flex items-center gap-2 font-medium">
              <span
                className={`h-2 w-2 rounded-full ${connected ? "bg-primary" : "bg-destructive"}`}
              />
              {connected
                ? "Connected"
                : p.whatsapp_status === "connecting"
                  ? "Waiting for link"
                  : "Not connected"}
            </p>
            <p className="mt-1 text-muted-foreground">
              {p.whatsapp_number ? displayPhone(p.whatsapp_number) : "No number linked"}
              {p.whatsapp_last_synced_at && ` · Last synced ${timeAgo(p.whatsapp_last_synced_at)}`}
            </p>
          </div>
          {connected && (
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={async () => {
                await disconnect();
                qc.invalidateQueries({ queryKey: ["workspace"] });
              }}
            >
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
              WhatsApp becomes the day-to-day interface. RevenueDesk can monitor leads, answer owner
              requests, schedule safe follow-ups and send proactive alerts without the dashboard.
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
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              WhatsApp
            </p>
            <p className="mt-1 text-sm font-semibold">
              {zeroWhatsAppConnected ? "Connected" : "Connect first"}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-background p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Automation
            </p>
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
                    toast.error(
                      error instanceof Error ? error.message : "Could not update automation",
                    );
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
            <p className="text-xs text-muted-foreground">
              Owner commands can schedule eligible follow-ups; replies cancel them.
            </p>
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
                toast.error(
                  error instanceof Error ? error.message : "Could not update follow-up setting",
                );
              } finally {
                setZeroSaving(false);
              }
            }}
          />
        </div>
        {!zeroWhatsAppConnected && (
          <p className="text-xs text-muted-foreground">
            Connect the business WhatsApp number above before enabling Zero UI.
          </p>
        )}
      </Card>
      <Card className="space-y-4">
        <h2 className="font-medium">Business profile</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="n">Business name</Label>
            <Input
              id="n"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="i">Industry</Label>
            <Input
              id="i"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="alert-phone">Owner alert number</Label>
            <Input
              id="alert-phone"
              value={alertPhone}
              onChange={(e) => setAlertPhone(e.target.value)}
              placeholder="e.g. 082 123 4567"
              className="h-11 rounded-xl"
              inputMode="tel"
            />
            <p className="text-xs text-muted-foreground">
              RevenueDesk uses this number for Zero UI owner commands and proactive alerts.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Working hours</Label>
          <HoursEditor value={hours} onChange={setHours} />
        </div>
        <Button onClick={save} disabled={saving} className="h-11 rounded-xl px-5 font-semibold">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-medium">Market Intelligence</h2>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Watch the market for this business</p>
            <p className="mt-1 max-w-xl text-xs text-muted-foreground">
              RevenueDesk will use your business profile, public sources and approved competitors to
              build evidence-backed market findings automatically.
            </p>
          </div>
          <Switch
            checked={marketEnabled}
            onCheckedChange={setMarketEnabled}
            disabled={marketSaving}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mi-website">Business website</Label>
            <Input
              id="mi-website"
              value={marketWebsite}
              onChange={(e) => setMarketWebsite(e.target.value)}
              placeholder="https://example.co.za"
              className="h-11 rounded-xl"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="mi-keywords">Topics/services to watch</Label>
            <Input
              id="mi-keywords"
              value={marketKeywords}
              onChange={(e) => setMarketKeywords(e.target.value)}
              placeholder="roof repairs, waterproofing, emergency leaks"
              className="h-11 rounded-xl"
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated terms. RevenueDesk also derives searches from your industry and
              services.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium">Competitors</p>
            <p className="mt-1 text-xs text-muted-foreground">
              RevenueDesk can discover competitors automatically. Add, ignore or remove specific
              ones here.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              value={newCompetitorName}
              onChange={(e) => setNewCompetitorName(e.target.value)}
              placeholder="Competitor name"
              className="h-10 rounded-xl"
            />
            <Input
              value={newCompetitorUrl}
              onChange={(e) => setNewCompetitorUrl(e.target.value)}
              placeholder="https://competitor.co.za"
              className="h-10 rounded-xl"
            />
            <Button
              type="button"
              onClick={addCompetitor}
              disabled={marketSaving || !newCompetitorName.trim() || !newCompetitorUrl.trim()}
              className="h-10 rounded-xl"
            >
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {marketLoading ? (
              <p className="text-sm text-muted-foreground">Loading competitors…</p>
            ) : marketCompetitors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No competitors added yet.</p>
            ) : (
              marketCompetitors.map((competitor) => (
                <div
                  key={competitor.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{competitor.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {competitor.website_url}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                      {competitor.status}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setCompetitorStatus(
                          competitor.id,
                          competitor.status === "ignored" ? "active" : "ignored",
                        )
                      }
                      className="rounded-xl"
                    >
                      {competitor.status === "ignored" ? "Use" : "Ignore"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteCompetitor(competitor.id)}
                      className="rounded-xl"
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={saveMarketIntelligence}
            disabled={marketSaving}
            className="h-11 rounded-xl"
          >
            {marketSaving ? "Saving…" : "Save Market Intelligence"}
          </Button>
        </div>
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="font-medium">Developer</h2>
          <p className="text-sm text-muted-foreground">
            Connect your own tools: pull leads through the API and get a webhook ping for every new
            lead. Included in your plan.
          </p>
        </div>

        <div className="space-y-2">
          <Label>API keys</Label>
          {devLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : devKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No API keys yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {devKeys.map((k) => (
                <li key={k.id} className="flex items-center justify-between gap-2">
                  <span>
                    {k.label} <span className="text-muted-foreground">({k.key_prefix}…)</span>
                    {k.last_used_at ? (
                      <span className="text-muted-foreground"> · last used {timeAgo(k.last_used_at)}</span>
                    ) : null}
                  </span>
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => onRevokeKey(k.id)}>
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={newKeyLabel}
              onChange={(e) => setNewKeyLabel(e.target.value)}
              placeholder="Key label, e.g. Website"
              className="max-w-xs"
            />
            <Button variant="outline" className="rounded-xl" onClick={onCreateKey} disabled={devSaving}>
              Create API key
            </Button>
          </div>
          {newKeyValue ? (
            <div className="rounded-xl border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Copy this key now. It is shown once.</p>
              <p className="mt-1 break-all font-mono text-xs">{newKeyValue}</p>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Use it as the <span className="font-mono">x-api-key</span> header on{" "}
            <span className="font-mono">GET /api/public/v1/leads</span>.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Webhooks</Label>
          {devHooks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No webhooks yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {devHooks.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2">
                  <span className="break-all">
                    {h.url} <span className="text-muted-foreground">({h.events.join(", ")})</span>
                  </span>
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={() => onDeleteWebhook(h.id)}>
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={newHookUrl}
              onChange={(e) => setNewHookUrl(e.target.value)}
              placeholder="https://your-server.example/hook"
              className="max-w-md"
            />
            <Button variant="outline" className="rounded-xl" onClick={onAddWebhook} disabled={devSaving}>
              Add webhook
            </Button>
          </div>
          {newHookSecret ? (
            <div className="rounded-xl border bg-muted/40 p-3 text-sm">
              <p className="font-medium">Copy this signing secret now. It is shown once.</p>
              <p className="mt-1 break-all font-mono text-xs">{newHookSecret}</p>
            </div>
          ) : null}
        </div>

        {devDeliveries.length > 0 ? (
          <div className="space-y-1">
            <Label>Recent deliveries</Label>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {devDeliveries.map((d) => (
                <li key={d.id}>
                  {d.ok ? "Delivered" : "Failed"} · {d.event}
                  {d.status ? ` · HTTP ${d.status}` : ""} · {timeAgo(d.attempted_at)}
                  {d.error ? ` · ${d.error}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <Card className="flex items-center justify-between gap-4">
        <div className="text-sm">
          <p className="font-medium">Account</p>
          <p className="text-muted-foreground">{ws.userEmail}</p>
        </div>
        <Button variant="outline" className="rounded-xl" onClick={signOut}>
          Log out
        </Button>
      </Card>

      <Card className="flex items-center justify-between gap-4">
        <div className="text-sm">
          <p className="font-medium">Support</p>
          <p className="text-muted-foreground">
            Questions or something not working? Email{" "}
            <a
              href="mailto:sales@nahalabs.co.za"
              className="text-primary underline underline-offset-2"
            >
              sales@nahalabs.co.za
            </a>{" "}
            and we will help.
          </p>
        </div>
      </Card>

      <Card className="space-y-3 border-destructive/40">
        <div className="text-sm">
          <p className="font-medium text-destructive">Delete account</p>
          <p className="mt-1 text-muted-foreground">
            Permanently deletes your account, your workspace and every conversation, lead and
            setting in it. This cannot be undone.
          </p>
        </div>
        {confirmDelete ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="destructive"
              onClick={deleteAccountForever}
              disabled={deleting}
              className="rounded-xl"
            >
              {deleting ? "Deleting…" : "Yes, delete everything"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="rounded-xl"
            >
              Keep my account
            </Button>
          </div>
        ) : (
          <div>
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(true)}
              className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              Delete account
            </Button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          See our{" "}
          <Link to="/privacy" className="underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link to="/terms" className="underline underline-offset-2">
            Terms
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
