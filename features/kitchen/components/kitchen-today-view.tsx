"use client";

import type { ReactNode } from "react";
import {
  type KitchenDay,
  type KitchenEvent
} from "@/features/kitchen/components/kitchen-shared";

export function TodayView({
  day,
  renderEvent,
  seesWholeBoard = true
}: {
  day: KitchenDay;
  /**
   * Draws one event's whole production panel, in place.
   *
   * The day view used to list cards that opened a dialog, so what the kitchen
   * is cooking today - the one thing this screen is for - was behind a click.
   * The panel is the view now, and the board hands it down rather than this
   * file reaching for it, so the two do not both have to know how an event is
   * wired to its actions.
   */
  renderEvent: (event: KitchenEvent) => ReactNode;
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
        // One column: each panel is a full sheet with its own aside and dish
        // grid, so two side by side would squeeze both into unreadability on
        // anything short of a very wide screen.
        <div className="space-y-3 bg-white p-3">
          {day.events.map((event) => (
            <div key={event.id}>{renderEvent(event)}</div>
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
