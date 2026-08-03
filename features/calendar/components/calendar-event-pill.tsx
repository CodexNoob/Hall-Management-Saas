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
  const colors: Record<CalendarStatus, string> = {
    confirmed:
      "border-[#b9ddcf] border-l-[#178151] bg-[#f5fbf8] text-[#17202a]",
    hold: "border-[#ead8bb] border-l-[#b66b00] bg-[#fffaf2] text-[#17202a]",
    school: "border-[#d2cff9] border-l-[#5649dd] bg-[#f8f7ff] text-[#17202a]"
  };

  return (
    <button
      className={[
        "flex w-full items-center gap-2 overflow-hidden rounded-md border border-l-4 px-2 py-1 text-left",
        colors[booking.status]
      ].join(" ")}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
        router.push(`/dashboard/event-manager?eventId=${booking.id}`);
      }}
      type="button"
    >
      <strong className="min-w-0 flex-1 truncate text-[11px]">
        {booking.title}
      </strong>

      <span className="max-w-16 truncate text-[9px] text-[#6a7483]">
        {booking.hall.replace("Nachlas Yehuda", "NY")}
      </span>
    </button>
  );
}
