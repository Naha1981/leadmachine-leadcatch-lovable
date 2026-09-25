import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span
        aria-hidden
        className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-primary text-[11px] font-bold text-primary-foreground"
      >
        LC
      </span>
      <span className="text-base text-foreground">
        LeadCatch <span className="text-muted-foreground">SA</span>
      </span>
    </span>
  );
}
