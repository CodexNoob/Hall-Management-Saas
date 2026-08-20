"use client";

import { Panel } from "@/components/ui/panel";
import { KitchenEventCard } from "@/features/kitchen/components/kitchen-event-card";
import { PlusButton } from "@/features/kitchen/components/kitchen-plus-button";
import {
  dayNames,
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
    <div
      className={`relative flex min-h-36 min-w-0 flex-col border-r border-t border-[#d8dde5] p-2 nth-[7n]:border-r-0 ${
        highlighted
          ? "z-1 bg-[#f4f9fd] ring-2 ring-inset ring-[#1f4d73]"
          : day.shabbos
            ? "bg-[#faf9ff]"
            : "bg-white"
      }`}
    >
      <div className="flex min-w-0 items-center justify-between gap-1">
        <strong
          className={`min-w-0 truncate text-xs font-black tabular-nums ${
            highlighted
              ? "text-[#1f4d73]"
              : day.shabbos
                ? "text-[#5649dd]"
                : "text-[#17202a]"
          }`}
        >
          {day.dateLabel}
        </strong>

        <PlusButton
          disabled={!canAddKitchenEvent}
          label={`Add kitchen event on ${day.dateLabel}`}
          onClick={() => onAddKitchenEvent(day.dateKey)}
        />
      </div>

      <div className="mt-1.5 min-w-0 space-y-1">
        {day.events?.map((event) => (
          <KitchenEventCard
            compact
            event={event}
            key={event.id}
            onSelect={onSelectEvent}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Four weeks at a glance.
 *
 * Drawn as one grid inside one card, the way the Calendar draws a month, rather
 * than as 28 separate bordered boxes floating on a mid-grey slab. It also no
 * longer carries its own Previous / Current / Next row: the board header has
 * those controls for every view, and two sets of date navigation on one screen
 * is one set too many.
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
      <Panel className="min-w-232">
        <div className="grid grid-cols-7 bg-[#fbfcfd]">
          {dayNames.map((dayName) => (
            <div
              className="border-r border-[#d8dde5] py-2.5 text-center text-[10px] font-black uppercase tracking-wider text-[#6a7483] last:border-r-0"
              key={dayName}
            >
              {dayName}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
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
      </Panel>
    </div>
  );
}
