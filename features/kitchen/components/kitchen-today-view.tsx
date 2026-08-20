"use client";

import { AsyncState } from "@/components/ui/async-state";
import { Panel } from "@/components/ui/panel";
import { KitchenEventCard } from "@/features/kitchen/components/kitchen-event-card";
import { PlusButton } from "@/features/kitchen/components/kitchen-plus-button";
import {
  eventCountLabel,
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
    <Panel className="dashboard-panel-enter">
      <header className="flex items-center justify-between gap-3 border-b border-[#d8dde5] bg-[#fbfcfd] px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-black text-[#17202a]">
            {day.today ? "Today" : day.dayName}
          </h2>
          <p className="mt-0.5 truncate text-xs text-[#6a7483]">
            {day.dateLabel} · {eventCountLabel(day.events)}
          </p>
        </div>

        <PlusButton
          disabled={!canAddKitchenEvent}
          label={`Add kitchen event on ${day.dateLabel}`}
          onClick={() => onAddKitchenEvent(day.dateKey)}
        />
      </header>

      {/* A busy day used to be one narrow column of cards down the left of a
          very wide white box. The cards carry their own detail, so they tile. */}
      <div className="p-3 sm:p-4">
        {day.events?.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {day.events.map((event) => (
              <KitchenEventCard
                event={event}
                key={event.id}
                onSelect={onSelectEvent}
              />
            ))}
          </div>
        ) : (
          <AsyncState
            emptyMessage={
              canAddKitchenEvent
                ? "Confirmed bookings appear here on their date. Use Add kitchen event for production that has no booking behind it."
                : "Confirmed bookings appear here on their date."
            }
            emptyTitle={`Nothing to cook on ${day.dateLabel}`}
            isEmpty
          />
        )}
      </div>
    </Panel>
  );
}
