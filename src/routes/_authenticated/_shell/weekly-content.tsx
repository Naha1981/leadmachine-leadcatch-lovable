import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { useWorkspace } from "@/lib/workspace";
import { PageHeader } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { gatherSignals, generatePlan, listPosts, updatePost, weekStart, type WeeklyPost } from "@/lib/weekly-content";

export const Route = createFileRoute("/_authenticated/_shell/weekly-content")({
  head: () => ({ meta: [{ title: "Weekly content — RevenueDesk" }, { name: "description", content: "A weekly content plan built from your enquiries, bookings and local demand. You approve everything." }] }),
  component: WeeklyContent,
});

const SOURCE_LABEL = { radar: "Local demand", enquiries: "Customer questions", bookings: "Bookings", trend: "Seasonal" } as const;

function WeeklyContent() {
  const { data: ws } = useWorkspace();
  const qc = useQueryClient();
  const tenantId = ws?.tenantId ?? "";
  const week = weekStart();
  const q = useQuery({ queryKey: ["weekly-posts", tenantId, week], enabled: !!ws, queryFn: () => listPosts(tenantId, week) });
  const [busy, setBusy] = useState(false);

  async function generate() {
    if (!ws) return;
    setBusy(true);
    try {
      const signals = await gatherSignals(tenantId);
      await generatePlan({ tenantId, industry: ws.profile.industry, businessName: ws.profile.business_name, suburb: ws.profile.suburb ?? "", signals, week });
      await qc.invalidateQueries({ queryKey: ["weekly-posts"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not build the plan"); }
    finally { setBusy(false); }
  }
  const posts = q.data ?? [];
  const approved = posts.filter((p) => p.status === "approved").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <PageHeader title="Weekly content" subtitle="A plan built from your customer questions, bookings and local demand. Nothing goes out until you approve it."
        action={<Button className="rounded-xl" disabled={busy || !ws} onClick={generate}>{posts.length ? "Rebuild plan" : "Build this week's plan"}</Button>} />
      {posts.length > 0 && <p data-testid="approved-count" className="text-sm text-muted-foreground">{approved} of {posts.length} approved. Approved posts are ready for you to share. RevenueDesk does not post for you.</p>}
      {posts.length === 0 && !q.isLoading && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No plan for this week yet. Build one and review each post.</div>
      )}
      <ul className="space-y-4">
        {posts.map((p) => <PostCard key={p.id} post={p} tenantId={tenantId} onChanged={() => qc.invalidateQueries({ queryKey: ["weekly-posts"] })} />)}
      </ul>
    </div>
  );
}

function PostCard({ post, tenantId, onChanged }: { post: WeeklyPost; tenantId: string; onChanged: () => void }) {
  const [copy, setCopy] = useState(post.copy);
  useEffect(() => setCopy(post.copy), [post.copy]);
  const dirty = copy !== post.copy;
  async function set(patch: Parameters<typeof updatePost>[2]) {
    try { await updatePost(tenantId, post.id, patch); onChanged(); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
  }
  const tone = post.status === "approved" ? "border-primary/40" : post.status === "rejected" ? "opacity-60" : "";
  return (
    <li data-testid="weekly-post" data-status={post.status} className={`rounded-2xl border border-border bg-card p-4 ${tone}`}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold">{post.post_day}</span>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground">{SOURCE_LABEL[post.source]}</span>
      </div>
      <h3 className="mt-2 text-sm font-semibold">{post.topic}</h3>
      {post.source_note && <p className="text-xs text-muted-foreground">Why: {post.source_note}</p>}
      <Textarea value={copy} onChange={(e) => setCopy(e.target.value)} rows={6} className="mt-3 rounded-xl text-sm" aria-label={`Post copy for ${post.post_day}`} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {dirty && <Button size="sm" variant="outline" className="rounded-lg" onClick={() => set({ copy })}>Save edits</Button>}
        <Button size="sm" className="rounded-lg" disabled={post.status === "approved" || dirty} onClick={() => set({ status: "approved" })}><Check className="mr-1 h-4 w-4" />{post.status === "approved" ? "Approved" : "Approve"}</Button>
        {post.status !== "rejected" ? <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => set({ status: "rejected" })}><X className="mr-1 h-4 w-4" />Skip</Button>
          : <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => set({ status: "draft" })}>Restore</Button>}
        <span className="ml-auto text-xs capitalize text-muted-foreground">{post.status}</span>
      </div>
    </li>
  );
}
