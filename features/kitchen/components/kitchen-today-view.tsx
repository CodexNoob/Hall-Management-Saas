"use client";

import { KitchenEventCard } from "@/features/kitchen/components/kitchen-event-card";
import {
  type KitchenDay,
  type KitchenEvent
} from "@/features/kitchen/components/kitchen-shared";

export function TodayView({
  day,
  onSelectEvent,
  seesWholeBoard = true
}: {
  day: KitchenDay;
  onSelectEvent: (event: KitchenEvent) => void;
  /**
   * False when the server sent only this cook's own dishes.
   *
   * It changes nothing but the empty state, and that one sentence matters: a
   * scoped cook is shown an empty day far more often than anyone else, and
   * "nothing is scheduled" is a claim about the kitchen that is usually false
   * when they see it. Defaults true so every other caller reads as before.
   */
  seesWholeBoard?: boolean;
}) {
  return (
    <section className="dashboard-panel-enter min-h-0 flex-1">
      {day.events?.length ? (
        <div className="grid gap-3 bg-white p-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {day.events.map((event) => (
            <KitchenEventCard
              event={event}
              key={event.id}
              onSelect={onSelectEvent}
            />
          ))}
        </div>
      ) : (
        <div
          className="flex min-h-28 w-full items-center justify-center border border-[#e8e8e8] bg-white px-4 py-8 text-center text-2xl font-black text-[#637085] sm:text-3xl"
          role="status"
        >
          {seesWholeBoard
            ? "No kitchen items scheduled for this day."
            : "Nothing assigned to you for this day."}
        </div>
      )}
    </section>
  );
}
