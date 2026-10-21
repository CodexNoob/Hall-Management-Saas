"use client";

import { KitchenEventCard } from "@/features/kitchen/components/kitchen-event-card";
import { PlusButton } from "@/features/kitchen/components/kitchen-plus-button";
import {
  type KitchenDay,
  type KitchenEvent
} from "@/features/kitchen/components/kitchen-shared";
import { useAppLanguage } from "@/components/providers/app-language-provider";

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
  const { t } = useAppLanguage();
  const highlighted = day.today;

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
        /*
         * The day name takes the slack; the button and the date take what they
         * need. Two symmetric `1fr` tracks split the row evenly, which was
         * generous to a date that is now two characters and mean to "Shabbos" -
         * the one day name long enough to notice, and the one nobody wants to
         * read as "Shabbo...".
         */
        className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5 px-2 py-2 ${
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
          disabled={!canAddKitchenEvent || day.past}
          label={t("kitchen.addEventOn", { date: day.dateLabel })}
          onClick={() => onAddKitchenEvent(day.dateKey)}
        />
        {/*
         * `text-right`, NOT `justify-self-end`.
         *
         * `justify-self-end` sizes a grid item to its content instead of its
         * track, so "Aug 23" laid itself out at its full 47px inside a 39px
         * column and hung the surplus off the LEFT edge - straight over the add
         * button, which is what put a "+Aug 23" in every cell on a phone.
         * `truncate` could not help, because the item never had a bounded width
         * to overflow. Stretched to the track and aligned with `text-right`, it
         * has one, so the worst case is an ellipsis rather than a collision.
         */}
        {/*
         * The month rides along on every card, not only where it changes.
         *
         * Dropping it to the 1st reads fine on a wall calendar, where you can
         * see the whole month at once. Here a cook scrolls a four-week strip
         * sideways on a phone and sees three cards at a time, so a bare "23"
         * leaves them working out which month they are looking at. The grid is
         * sized to fit "Aug 23" instead.
         *
         * `text-right`, NOT `justify-self-end`: the latter sizes a grid item to
         * its content rather than its track, so an over-long date laid itself
         * out full width and hung the surplus off its LEFT edge, straight over
         * the add button. Stretched to the track, `truncate` has a width to
         * work with and the worst case is an ellipsis rather than a collision.
         */}
        <span className="min-w-0 truncate text-right text-sm font-black tabular-nums text-[#64748b]">
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
      {/*
       * Wide enough for what a day header has to say, rather than as narrow as
       * it can be squeezed.
       *
       * Seven columns out of the old 232 gave each day 126px, against roughly
       * 145px of content: "Shabbos", the add button, and "Aug 23", plus the
       * padding and gaps between them. Something had to give, and the first
       * attempt gave up the month - which cost every cook the answer to "which
       * month am I looking at" on a strip they scroll three cards at a time.
       *
       * So the grid buys the room instead. It already scrolls sideways below its
       * minimum, so this costs a little more scrolling on a phone and nothing at
       * all on a desktop, where the grid is wider than this minimum anyway.
       */}
      <div className="grid min-w-304 grid-cols-7 gap-2">
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
