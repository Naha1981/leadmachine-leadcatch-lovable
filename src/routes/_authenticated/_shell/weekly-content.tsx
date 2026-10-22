import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X, CalendarClock, ExternalLink, RotateCcw } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  gatherSignals, generatePlan, listPosts, updatePost, weekStart,
  listChannelAccounts, connectChannel, sendToChannel, cancelChannelPost, syncChannelStatus, markSentToChannel, clearChannelState,
  type WeeklyPost, type ChannelAccount,
} from "@/lib/weekly-content";

export const Route = createFileRoute("/_authenticated/_shell/weekly-content")({
  head: () => ({ meta: [{ title: "Weekly content — RevenueDesk" }, { name: "description", content: "A weekly content plan built from your enquiries, bookings and local demand. Approve a post and it goes out on your social account by itself." }] }),
  component: WeeklyContent,
});

const SOURCE_LABEL = { radar: "Local demand", enquiries: "Customer questions", bookings: "Bookings", trend: "Seasonal" } as const;

function WeeklyContent() {
  const { data: ws } = useWorkspace();
  const qc = useQueryClient();
  const tenantId = ws?.tenantId ?? "";
  const week = weekStart();
  const q = useQuery({ queryKey: ["weekly-posts", tenantId, week], enabled: !!ws, queryFn: () => listPosts(tenantId, week) });
  const acc = useQuery({ queryKey: ["channel-accounts", tenantId], enabled: !!ws, queryFn: listChannelAccounts });
  const [busy, setBusy] = useState(false);

  // Pull the latest posting status (scheduled -> posted) whenever the screen opens.
  useEffect(() => {
    if (!ws || !q.data) return;
    syncChannelStatus(tenantId, q.data).then(() => qc.invalidateQueries({ queryKey: ["weekly-posts"] })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws, q.data?.length]);

  async function generate() {
    if (!ws) return;
    setBusy(true);
    try {
      const signals = await gatherSignals(tenantId, { industry: ws.profile.industry, area: ws.profile.suburb ?? "" });
      await generatePlan({ tenantId, industry: ws.profile.industry, businessName: ws.profile.business_name, suburb: ws.profile.suburb ?? "", signals, week });
      await qc.invalidateQueries({ queryKey: ["weekly-posts"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not build the plan"); }
    finally { setBusy(false); }
  }
  const posts = q.data ?? [];
  const accounts = acc.data ?? [];
  const approved = posts.filter((p) => p.status === "approved").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader title="Weekly content" subtitle="A plan built from your customer questions, bookings and local demand. Approve a post and it goes out on your social account by itself, on its day."
        action={<Button className="rounded-xl" disabled={busy || !ws} onClick={generate}>{posts.length ? "Rebuild plan" : "Build this week's plan"}</Button>} />
      {!acc.isLoading && accounts.length === 0 && <ConnectCard onConnected={() => qc.invalidateQueries({ queryKey: ["channel-accounts"] })} />}
      {accounts.length > 0 && (
        <p data-testid="channel-connected" className="text-sm text-muted-foreground">
          Posting to <span className="font-medium text-foreground">{accounts[0]!.handle}</span> on Bluesky. Approve a post and it goes out on its day. {approved > 0 ? `${approved} approved this week.` : ""}
        </p>
      )}
      {posts.length === 0 && !q.isLoading && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No plan for this week yet. Build one and review each post.</div>
      )}
      <ul className="space-y-4">
        {posts.map((p) => <PostCard key={p.id} post={p} tenantId={tenantId} week={week} connected={accounts.length > 0} onChanged={() => qc.invalidateQueries({ queryKey: ["weekly-posts"] })} />)}
      </ul>
    </div>
  );
}

function ConnectCard({ onConnected }: { onConnected: () => void }) {
  const [handle, setHandle] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  async function connect() {
    setBusy(true);
    try {
      await connectChannel("bluesky", handle.trim(), pw.trim());
      toast.success("Account connected. Approved posts will go out by themselves.");
      onConnected();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not connect"); }
    finally { setBusy(false); }
  }
  return (
    <div data-testid="connect-channel" className="space-y-3 rounded-2xl border border-primary/30 bg-card p-4">
      <h3 className="text-sm font-semibold">Connect your social account</h3>
      <p className="text-xs text-muted-foreground">
        Approved posts publish to your Bluesky account automatically. Enter your Bluesky handle and an app password
        (in Bluesky: Settings → Privacy and security → App passwords). Your password is stored encrypted and never shown again.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="yourbusiness.bsky.social" aria-label="Bluesky handle" className="rounded-xl" />
        <Input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder="App password" aria-label="Bluesky app password" className="rounded-xl" />
        <Button className="rounded-xl" disabled={busy || !handle.trim() || !pw.trim()} onClick={connect}>{busy ? "Connecting…" : "Connect"}</Button>
      </div>
    </div>
  );
}

function PostCard({ post, tenantId, week, connected, onChanged }: { post: WeeklyPost; tenantId: string; week: string; connected: boolean; onChanged: () => void }) {
  const [copy, setCopy] = useState(post.copy);
  const [sending, setSending] = useState(false);
  useEffect(() => setCopy(post.copy), [post.copy]);
  const dirty = copy !== post.copy;
  async function set(patch: Parameters<typeof updatePost>[2]) {
    try { await updatePost(tenantId, post.id, patch); onChanged(); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
  }
  async function approve() {
    setSending(true);
    try {
      if (dirty) await updatePost(tenantId, post.id, { copy });
      if (!connected) { await updatePost(tenantId, post.id, { status: "approved" }); toast.message("Approved. Connect your social account above and it will go out by itself."); onChanged(); return; }
      const r = await sendToChannel({ ...post, copy }, week);
      await markSentToChannel(tenantId, post.id, r);
      toast.success(r.state === "published" ? "Posted to your social account." : r.scheduled_for ? `Scheduled for ${new Date(r.scheduled_for).toLocaleString("en-ZA", { weekday: "long", hour: "2-digit", minute: "2-digit" })}.` : "Sent for posting.");
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not send the post"); }
    finally { setSending(false); }
  }
  async function cancelScheduled() {
    if (!post.channel_post_id) return;
    setSending(true);
    try {
      await cancelChannelPost(post.channel_post_id);
      await clearChannelState(tenantId, post.id);
      toast.message("Cancelled. The post is back to a draft.");
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not cancel"); }
    finally { setSending(false); }
  }
  const tone = post.publish_state === "published" ? "border-primary/50" : post.status === "approved" ? "border-primary/40" : post.status === "rejected" ? "opacity-60" : "";
  return (
    <li data-testid="weekly-post" data-status={post.status} data-publish={post.publish_state ?? ""} className={`rounded-2xl border border-border bg-card p-4 ${tone}`}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold">{post.post_day}</span>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">{SOURCE_LABEL[post.source]}</span>
      </div>
      <h3 className="mt-2 text-sm font-semibold">{post.topic}</h3>
      {post.source_note && <p className="text-xs text-muted-foreground">Why: {post.source_note}</p>}
      <Textarea value={copy} onChange={(e) => setCopy(e.target.value)} rows={6} className="mt-3 rounded-xl text-sm" aria-label={`Post copy for ${post.post_day}`} disabled={!!post.publish_state} />
      {post.publish_state === "published" && post.posted_url && (
        <a data-testid="posted-link" href={post.posted_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          <ExternalLink className="h-3.5 w-3.5" /> Posted on your social account — view it
        </a>
      )}
      {post.publish_state === "scheduled" && post.scheduled_for && (
        <p data-testid="scheduled-note" className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" /> Goes out by itself {new Date(post.scheduled_for).toLocaleString("en-ZA", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
      {post.publish_state === "failed" && (
        <p data-testid="failed-note" className="mt-2 text-xs text-destructive">This post could not go out{post.post_error ? `: ${post.post_error}` : ""}. Fix the copy or reconnect your account, then try again.</p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {dirty && !post.publish_state && <Button size="sm" variant="outline" className="rounded-lg" onClick={() => set({ copy })}>Save edits</Button>}
        {!post.publish_state && (
          <Button size="sm" className="rounded-lg" disabled={post.status === "approved" || sending} onClick={approve}>
            <Check className="mr-1 h-4 w-4" />{sending ? "Sending…" : post.status === "approved" ? "Approved" : connected ? "Approve — post it for me" : "Approve"}
          </Button>
        )}
        {post.publish_state === "failed" && (
          <Button size="sm" className="rounded-lg" disabled={sending} onClick={approve}><RotateCcw className="mr-1 h-4 w-4" />Try again</Button>
        )}
        {post.publish_state === "scheduled" && (
          <Button size="sm" variant="ghost" className="rounded-lg" disabled={sending} onClick={cancelScheduled}><X className="mr-1 h-4 w-4" />Cancel this post</Button>
        )}
        {!post.publish_state && (post.status !== "rejected"
          ? <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => set({ status: "rejected" })}><X className="mr-1 h-4 w-4" />Skip</Button>
          : <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => set({ status: "draft" })}>Restore</Button>)}
        <span className="ml-auto text-xs capitalize text-muted-foreground">
          {post.publish_state === "published" ? "Posted" : post.publish_state === "scheduled" ? "Scheduled" : post.publish_state === "failed" ? "Failed" : post.status}
        </span>
      </div>
    </li>
  );
}
