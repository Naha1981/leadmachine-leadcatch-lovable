import logo from "@/assets/2ndlife-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="2ndLife by NahaLabs"
      className={cn("h-9 w-auto object-contain", className)}
      loading="eager"
      decoding="async"
    />
  );
}