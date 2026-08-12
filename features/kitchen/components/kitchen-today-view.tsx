"use client";

import { KitchenEventCard } from "@/features/kitchen/components/kitchen-event-card";
import { PlusButton } from "@/features/kitchen/components/kitchen-plus-button";
import {
  type KitchenDay,
  type KitchenEvent
} from "@/features/kitchen/components/kitchen-shared";

export function TodayView({
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
  return (
    <section className="min-h-120 border border-[#d8dde5] bg-white p-2">
      <header className="flex items-center justify-between border-b border-[#d8dde5] px-2 pb-2">
        <h2 className="text-lg font-black text-[#0077b7]">
          {day.today ? "Today" : day.dayName}
        </h2>

        <div className="flex items-center gap-2">
          <PlusButton
            disabled={!canAddKitchenEvent}
            label={`Add kitchen event on ${day.dateLabel}`}
            onClick={() => onAddKitchenEvent(day.dateKey)}
          />
          <strong className="text-sm text-[#536780]">{day.dateLabel}</strong>
        </div>
      </header>

      <div className="mt-3">
        {day.events?.length ? (
          day.events.map((event) => (
            <KitchenEventCard
              event={event}
              key={event.id}
              onSelect={onSelectEvent}
            />
          ))
        ) : (
          <p className="text-sm font-black text-[#536780]">No events</p>
        )}
      </div>
    </section>
  );
}
