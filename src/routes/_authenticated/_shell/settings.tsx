import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { disconnectWhatsApp } from "@/lib/whatsapp.functions";
import type { WorkingHours } from "@/lib/autoreply";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, PageHeader, displayPhone, timeAgo } from "@/components/ui-bits";
import { HoursEditor } from "@/components/HoursEditor";
import { WhatsAppConnect } from "@/components/WhatsAppConnect";

export const Route = createFileRoute("/_authenticated/_shell/settings")({
  head: () => ({
    meta: [
      { title: "Settings — LeadCatch SA" },
      { name: "description", content: "Business profile, working hours, WhatsApp connection and account." },
      { property: "og:title", content: "Settings — LeadCatch SA" },
      { property: "og:description", content: "Manage your LeadCatch SA settings." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: ws } = useWorkspace();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const disconnect = useServerFn(disconnectWhatsApp);
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [hours, setHours] = useState<WorkingHours | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ws) return;
    setName(ws.profile.business_name);
    setIndustry(ws.profile.industry);
    setHours(ws.profile.working_hours as WorkingHours);
  }, [ws]);

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
      .update({ business_name: name.trim(), industry: industry.trim(), working_hours: hours!, updated_at: new Date().toISOString() })
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
