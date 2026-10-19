import { CalendarCheck } from "lucide-react";
import { slotLabel } from "@/lib/bookings";

export function BookingCard({ startsAt, service }: { startsAt?: string | null | undefined; service?: string | null | undefined }) {
  return (
    <div data-testid="booking-confirmed-card" className="w-64 rounded-2xl border border-primary/30 bg-primary/10 p-3.5">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <CalendarCheck className="h-4 w-4" /> Booking confirmed
      </div>
      {startsAt && <p className="mt-1.5 text-sm font-medium text-foreground">{slotLabel(startsAt)}</p>}
      {service && <p className="text-xs text-muted-foreground">{service}</p>}
    </div>
  );
}
