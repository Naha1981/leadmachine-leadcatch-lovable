import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { connectWhatsApp, getWhatsAppStatus, requestPairingCode } from "@/lib/whatsapp.functions";

/** Linking flow: start session → show QR (or pairing code) → poll until connected. */
export function WhatsAppConnect({ onConnected }: { onConnected?: () => void }) {
  const qc = useQueryClient();
  const connect = useServerFn(connectWhatsApp);
  const status = useServerFn(getWhatsAppStatus);
  const pair = useServerFn(requestPairingCode);
  const [phase, setPhase] = useState<"idle" | "linking" | "connected">("idle");
  const [qr, setQr] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (phase !== "linking") return;
    let alive = true;
    const tick = async () => {
      try {
        const s = await status();
        if (!alive) return;
        setQr(s.qrCode);
        if (s.status === "connected") {
          setPhase("connected");
          qc.invalidateQueries({ queryKey: ["workspace"] });
          toast.success("WhatsApp connected");
          onConnected?.();
        }
      } catch {
        /* keep polling */
      }
    };
    tick();
    const t = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [phase, status, qc, onConnected]);

  async function start() {
    setBusy(true);
    try {
      const r = await connect();
      if (r.status === "connected") {
        setPhase("connected");
        qc.invalidateQueries({ queryKey: ["workspace"] });
        onConnected?.();
      } else setPhase("linking");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reach the WhatsApp service");
    } finally {
      setBusy(false);
    }
  }

  async function getCode() {
    try {
      const r = await pair({ data: { phoneNumber: phone } });
      setCode(r.code);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not get a code");
    }
  }

  if (phase === "connected") {
    return <p className="text-sm font-medium text-primary">Connected. New messages will appear in your inbox.</p>;
  }

  if (phase === "idle") {
    return (
      <Button onClick={start} disabled={busy} className="h-11 rounded-xl font-semibold">
        {busy ? "Starting…" : "Connect WhatsApp"}
      </Button>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
      <div className="flex h-52 w-52 items-center justify-center rounded-2xl bg-foreground p-3">
        {qr ? <QRCodeSVG value={qr} size={184} /> : <span className="text-xs text-background">Generating code…</span>}
      </div>
      <div className="space-y-4 text-sm">
        <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
          <li>Open WhatsApp on your phone</li>
          <li>Tap Settings → Linked devices → Link a device</li>
          <li>Point your phone at this code</li>
        </ol>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Can't scan? Link with your phone number instead.</p>
          <div className="flex gap-2">
            <Input placeholder="27821234567" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-10 rounded-xl" inputMode="tel" />
            <Button variant="secondary" onClick={getCode} className="h-10 rounded-xl">Get code</Button>
          </div>
          {code && <p className="font-mono text-lg tracking-[0.3em] text-primary">{code}</p>}
        </div>
      </div>
    </div>
  );
}
