export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M4 11.5C4 7.36 7.58 4 12 4s8 3.36 8 7.5S16.42 19 12 19c-1.1 0-2.15-.2-3.1-.57L4.5 20l1.1-3.7A7.1 7.1 0 0 1 4 11.5Z"
        className="stroke-primary"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="m8.8 11.6 2.2 2.2 4.3-4.4" className="stroke-primary" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight text-foreground">
        LeadMachine <span className="text-muted-foreground">SA</span>
      </span>
    </span>
  );
}
