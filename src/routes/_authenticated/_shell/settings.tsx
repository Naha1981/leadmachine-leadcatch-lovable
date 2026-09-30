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

  useEffect(() => {
    if (!ws) return;
    setName(ws.profile.business_name);
    setIndustry(ws.profile.industry);
    setAlertPhone(ws.profile.contact_phone ?? "");
    setHours(ws.profile.working_hours as WorkingHours);
  }, [ws]);

  useEffect(() => {
    if (!ws) return;
    let active = true;
    setZeroLoading(true);
    loadZeroUI({ data: undefined })
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
