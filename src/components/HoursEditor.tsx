import { Input } from "@/components/ui/input";
import type { WorkingHours } from "@/lib/autoreply";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function HoursEditor({ value, onChange }: { value: WorkingHours; onChange: (v: WorkingHours) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-1.5">
        {DAYS.map((d, i) => {
          const on = value.days.includes(i);
          return (
            <button
              key={d}
              type="button"
              onClick={() => onChange({ ...value, days: on ? value.days.filter((x) => x !== i) : [...value.days, i].sort() })}
              className={`h-10 rounded-xl text-xs font-medium transition-colors ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <Input type="time" value={value.start} onChange={(e) => onChange({ ...value, start: e.target.value })} className="h-11 rounded-xl" />
        <span className="text-sm text-muted-foreground">to</span>
        <Input type="time" value={value.end} onChange={(e) => onChange({ ...value, end: e.target.value })} className="h-11 rounded-xl" />
      </div>
      <p className="text-xs text-muted-foreground">South African time (SAST).</p>
    </div>
  );
}
