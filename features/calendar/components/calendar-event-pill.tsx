"use client";

import { useRouter } from "next/navigation";
import { type CalendarBooking, type CalendarStatus } from "@/features/calendar/components/calendar-shared";

export function EventPill({
  booking,
  onSelect
}: {
  booking: CalendarBooking;
  onSelect: () => void;
}) {
  const router = useRouter();
  const statusColors: Record<CalendarStatus, string> = {
    confirmed: "bg-[#178151]",
    hold: "bg-[#b66b00]",
    school: "bg-[#5649dd]"
  };
  const hallColor = booking.hallColor ?? "#1f4d73";
  const hallTint =
    /^#[0-9a-fA-F]{6}$/.test(hallColor) ? `${hallColor}18` : "#eef4fa";

  return (
    <button
      className="flex w-full items-center gap-2 overflow-hidden rounded-md border border-l-4 px-2 py-1 text-left text-[#17202a]"
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
        router.push(`/dashboard/event-manager?eventId=${booking.id}`);
      }}
      style={{
        backgroundColor: hallTint,
        borderColor: hallColor,
        borderLeftColor: hallColor
      }}
      type="button"
    >
      <span
        aria-label={booking.status}
        className={`h-2 w-2 shrink-0 rounded-full ${statusColors[booking.status]}`}
      />
      <strong className="min-w-0 flex-1 truncate text-[11px]">
        {booking.title}
      </strong>

      <span className="max-w-16 truncate text-[9px] text-[#6a7483]">
        {booking.hall.replace("Nachlas Yehuda", "NY")}
      </span>
    </button>
  );
}
