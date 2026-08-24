"use client";

import { KitchenEventCard } from "@/features/kitchen/components/kitchen-event-card";
import { PlusButton } from "@/features/kitchen/components/kitchen-plus-button";
import {
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
  const highlighted = day.today || day.selected;

  return (
    <section
      className={`flex min-h-52 flex-col border-2 bg-white lg:min-h-[calc(100dvh-190px)] ${
        highlighted
          ? "border-[#1bb7ff] bg-[#eefaff]"
          : day.shabbos
            ? "border-[#b693ff] bg-white"
            : "border-transparent"
      }`}
    >
      <header
        className={`shrink-0 px-2.5 py-2 ${
          day.shabbos
            ? "border-b-2 border-[#7c2dff]"
            : highlighted
              ? "border-b-2 border-[#1bb7ff]"
              : "border-b-2 border-[#061126]"
        }`}
      >
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1.5">
          <h2
            className={`min-w-0 truncate text-sm font-black ${
              day.shabbos
                ? "text-[#7c2dff]"
                : highlighted
                  ? "text-[#0077b6]"
                  : "text-[#061126]"
            }`}
            title={day.dayName}
          >
            {day.dayName}
          </h2>

          <PlusButton
            disabled={!canAddKitchenEvent}
            label={`Add kitchen event on ${day.dateLabel}`}
            onClick={() => onAddKitchenEvent(day.dateKey)}
          />
          <p className="min-w-0 justify-self-end truncate text-sm font-black tabular-nums text-[#64748b]">
            {day.dateLabel}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {day.events?.length ? (
          day.events.map((event) => (
            <KitchenEventCard
              event={event}
              key={event.id}
              onSelect={onSelectEvent}
            />
          ))
        ) : (
          <p className="px-1 py-4 text-sm font-black text-[#64748b]">
            No events
          </p>
        )}
      </div>
    </section>
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
    <div className="dashboard-panel-enter grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 lg:gap-2">
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
