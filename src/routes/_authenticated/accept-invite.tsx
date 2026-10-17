import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui-bits";
import { myPendingInvites, acceptInvite } from "@/lib/team.functions";

export const Route = createFileRoute("/_authenticated/accept-invite")({
  head: () => ({ meta: [{ title: "Team invite — RevenueDesk" }] }),
  component: AcceptInvitePage,
});

type Invite = { id: string; business_name: string; role: string; created_at: string };

function AcceptInvitePage() {
  const navigate = useNavigate();
  const loadInvites = useServerFn(myPendingInvites);
  const accept = useServerFn(acceptInvite);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState("");

  useEffect(() => {
    let active = true;
    loadInvites()
      .then((d) => {
        if (active) setInvites(d.invites);
      })
      .catch(() => toast.error("Could not load invites"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadInvites]);

  async function onAccept(id: string) {
    setAccepting(id);
    try {
      await accept({ data: { id } });
      toast.success("Welcome to the team");
      navigate({ to: "/inbox" });
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not accept invite");
      setAccepting("");
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <PageHeader title="Team invite" subtitle="Join a workspace on RevenueDesk." />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : invites.length === 0 ? (
        <Card className="text-sm text-muted-foreground">
          No pending invites for your email address. Ask the workspace owner to invite the email you
          signed up with.
        </Card>
      ) : (
        invites.map((inv) => (
          <Card key={inv.id} className="flex items-center justify-between gap-4">
            <div className="text-sm">
              <p className="font-medium">{inv.business_name || "A workspace"}</p>
              <p className="text-muted-foreground">
                Invites you to join their team. You will see their inbox, leads and quotes.
              </p>
            </div>
            <Button className="rounded-xl" onClick={() => onAccept(inv.id)} disabled={Boolean(accepting)}>
              {accepting === inv.id ? "Joining…" : "Accept"}
            </Button>
          </Card>
        ))
      )}
    </div>
  );
}
