"use client";

import { Badge, LineIcon, type EventFile } from "@/features/events/components/event-manager-shared";

export function EventListCard({
  event,
  selected,
  onClick
}: {
  event: EventFile;
  selected: boolean;
  onClick: () => void;
}) {
  const statusTone = event.status === "Confirmed" ? "green" : "gold";

  return (
    <button
      className={`w-full rounded-lg border p-2.5 text-left transition ${
        selected
          ? "border-[#1f4d73] bg-[#eef4fa]"
          : "border-[#d8dde5] bg-white hover:border-[#b9c2cf] hover:bg-[#fbfcfd]"
      }`}
      type="button"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#b9c2cf] bg-[#fbfcfd] text-[#1f4d73]">
          <LineIcon name="calendar" className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-black text-[#17202a]">
              {event.title}
            </h3>
            <Badge tone={statusTone}>{event.status}</Badge>
          </div>
          <div className="mt-1 flex items-start justify-between gap-2 text-[11px] leading-5 text-[#6a7483]">
            <p className="min-w-0">
              {event.date} at {event.time} - {event.room}
              <br />
              {event.packageName} - {event.guests} guests - {event.coordinator}
            </p>
            <span className="shrink-0 text-right text-[#17202a]">
              {event.balance}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {event.notes.map((note) => (
              <Badge
                key={note}
                tone={
                  note.includes("Not")
                    ? "red"
                    : note.includes("Needs")
                      ? "gold"
                      : "green"
                }
              >
                {note}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}
