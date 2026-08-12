"use client";

import { KitchenEventCard } from "@/features/kitchen/components/kitchen-event-card";
import { PlusButton } from "@/features/kitchen/components/kitchen-plus-button";
import { type KitchenDay, type KitchenEvent } from "@/features/kitchen/components/kitchen-shared";

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
  const outerBorderColor =
    day.today || day.selected
      ? "border-[#009ee8]"
      : day.shabbos
        ? "border-[#a25bff]"
        : "border-transparent";
  const headerBorderColor =
    day.today || day.selected
      ? "border-[#009ee8]"
      : day.shabbos
        ? "border-[#a25bff]"
        : "border-[#07162d]";

  const headingColor =
    day.today || day.selected
      ? "text-[#0077b7]"
      : day.shabbos
        ? "text-[#8b37f5]"
        : "text-[#07162d]";

  return (
    <article
      className={`flex min-h-120 min-w-0 flex-col border-2 bg-white p-2 md:p-1.5 xl:p-2 ${outerBorderColor} ${
        day.today || day.selected ? "bg-[#edf9ff]" : ""
      }`}
    >
      <header
        className={`flex min-w-0 items-center justify-between border-b-2 pb-2 md:flex-col md:items-stretch md:gap-1 xl:flex-row xl:items-center ${headerBorderColor}`}
      >
        <h2
          className={`min-w-0 truncate font-black md:text-xs xl:text-base ${
            day.shabbos ? "text-sm" : "text-base"
          } ${headingColor}`}
          title={day.dayName}
        >
          {day.dayName}
        </h2>

        <div className="flex min-w-0 shrink-0 items-center gap-1 md:justify-between xl:justify-start">
          <PlusButton
            disabled={!canAddKitchenEvent}
            label={`Add kitchen event on ${day.dateLabel}`}
            onClick={() => onAddKitchenEvent(day.dateKey)}
          />
          <strong
            className={`min-w-0 truncate whitespace-nowrap ${
              day.shabbos ? "text-xs" : "text-sm"
            } md:text-[10px] xl:text-sm ${
              day.shabbos ? "text-[#8b37f5]" : "text-[#536780]"
            }`}
          >
            {day.dateLabel}
          </strong>
        </div>
      </header>

      <div className="mt-3">
        {day.events?.length ? (
          <div className="space-y-2">
            {day.events.map((event) => (
              <KitchenEventCard
                event={event}
                key={event.id}
                onSelect={onSelectEvent}
              />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm font-black text-[#536780]">No events</p>
        )}
      </div>
    </article>
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
    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-7 md:gap-1 xl:gap-2">
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
