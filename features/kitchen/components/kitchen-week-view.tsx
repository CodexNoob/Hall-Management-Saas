"use client";

import { Panel } from "@/components/ui/panel";
import { KitchenEventCard } from "@/features/kitchen/components/kitchen-event-card";
import { PlusButton } from "@/features/kitchen/components/kitchen-plus-button";
import {
  kitchenDayTone,
  type KitchenDay,
  type KitchenEvent
} from "@/features/kitchen/components/kitchen-shared";

export function WeekDayColumn({
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
  const tone = kitchenDayTone(day);

  return (
    <Panel className={`flex min-h-100 flex-col ${tone.outline}`}>
      <header
        className={`shrink-0 border-b px-2.5 py-2 ${tone.header} md:px-2 xl:px-2.5`}
      >
        <div className="flex min-w-0 items-center justify-between gap-1.5">
          <h2
            className={`min-w-0 truncate text-sm font-black md:text-xs xl:text-sm ${tone.title}`}
            title={day.dayName}
          >
            {day.dayName}
          </h2>

          <PlusButton
            disabled={!canAddKitchenEvent}
            label={`Add kitchen event on ${day.dateLabel}`}
            onClick={() => onAddKitchenEvent(day.dateKey)}
          />
        </div>

        <p
          className={`mt-0.5 truncate text-[11px] font-bold tabular-nums ${tone.date}`}
        >
          {day.dateLabel}
        </p>
      </header>

      <div className="min-h-0 flex-1 space-y-2 p-2">
        {day.events?.length ? (
          day.events.map((event) => (
            <KitchenEventCard
              event={event}
              key={event.id}
              onSelect={onSelectEvent}
            />
          ))
        ) : (
          <p className="px-1 py-2 text-[11px] font-bold text-[#94a1b1]">
            No events
          </p>
        )}
      </div>
    </Panel>
  );
}

export function WeekView({
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
    <div className="dashboard-panel-enter grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 lg:gap-1.5 xl:gap-2">
      {days.map((day) => (
        <WeekDayColumn
          canAddKitchenEvent={canAddKitchenEvent}
          day={day}
          key={day.dateKey}
          onAddKitchenEvent={onAddKitchenEvent}
          onSelectEvent={onSelectEvent}
        />
      ))}
    </div>
  );
}
