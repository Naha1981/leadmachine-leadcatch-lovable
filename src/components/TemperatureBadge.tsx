const STYLE: Record<string, string> = {
  hot: "bg-destructive/15 text-destructive",
  warm: "bg-warning/15 text-warning",
  cold: "bg-muted text-muted-foreground",
};

export function TemperatureBadge({ temperature }: { temperature: string }) {
  return (
    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STYLE[temperature] ?? STYLE["cold"]}`}>
      {temperature}
    </span>
  );
}
