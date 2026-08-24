"use client";

import { KitchenEventCard } from "@/features/kitchen/components/kitchen-event-card";
import { PlusButton } from "@/features/kitchen/components/kitchen-plus-button";
import {
  type KitchenDay,
  type KitchenEvent
} from "@/features/kitchen/components/kitchen-shared";

export function FourWeekDay({
  canAddKitchenEvent,
  day,
  onAddKitchenEvent,
  onSelectEvent
}: {
  canAddKitchenEvent: boolean;
  day: KitchenDay;
  onAddKitchenEvent: (dateKey: string) => void;
  onSelectEvent: (event: KitchenEvent) => void;
}) {
  const highlighted = day.today || day.selected;

  return (
    <section
      className={`relative flex min-h-43 min-w-0 flex-col border-2 bg-white ${
        highlighted
          ? "z-1 border-[#1bb7ff] bg-[#eefaff]"
          : day.shabbos
            ? "border-[#b693ff]"
            : "border-transparent"
      }`}
    >
      <header
        className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5 px-2 py-2 ${
          day.shabbos
            ? "border-b-2 border-[#7c2dff]"
            : highlighted
              ? "border-b-2 border-[#1bb7ff]"
              : "border-b border-[#cfd6df]"
        }`}
      >
        <strong
          className={`min-w-0 truncate text-sm font-black ${
            highlighted
              ? "text-[#0077b6]"
              : day.shabbos
                ? "text-[#7c2dff]"
                : "text-[#061126]"
          }`}
        >
          {day.dayName}
        </strong>

        <PlusButton
          disabled={!canAddKitchenEvent}
          label={`Add kitchen event on ${day.dateLabel}`}
          onClick={() => onAddKitchenEvent(day.dateKey)}
        />
        <span className="min-w-0 justify-self-end truncate text-sm font-black tabular-nums text-[#64748b]">
          {day.dateLabel}
        </span>
      </header>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {day.events?.map((event) => (
          <KitchenEventCard
            compact
            event={event}
            key={event.id}
            onSelect={onSelectEvent}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Four weeks at a glance.
 *
 * Four weeks at a glance, drawn like the dedicated kitchen wall board: big
 * white cells on the grey slab, with the add control in every date header.
 */
export function FourWeeksView({
  canAddKitchenEvent,
  days,
  onAddKitchenEvent,
  onSelectEvent
}: {
  canAddKitchenEvent: boolean;
  days: KitchenDay[];
  onAddKitchenEvent: (dateKey: string) => void;
  onSelectEvent: (event: KitchenEvent) => void;
}) {
  return (
    <div className="dashboard-panel-enter w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-2">
      <div className="grid min-w-232 grid-cols-7 gap-2">
        {days.map((day) => (
          <FourWeekDay
            canAddKitchenEvent={canAddKitchenEvent}
            day={day}
            key={day.dateKey}
            onAddKitchenEvent={onAddKitchenEvent}
            onSelectEvent={onSelectEvent}
          />
        ))}
      </div>
    </div>
  );
}
