"use client";

import { KitchenEventCard } from "@/features/kitchen/components/kitchen-event-card";
import { PlusButton } from "@/features/kitchen/components/kitchen-plus-button";
import { type KitchenDay, type KitchenEvent } from "@/features/kitchen/components/kitchen-shared";

export function FourWeekDay({
  day,
  onAddKitchenEvent,
  onSelectEvent
}: {
  day: KitchenDay;
  onAddKitchenEvent: (dateKey: string) => void;
  onSelectEvent: (event: KitchenEvent) => void;
}) {
  const weekdayLabel = day.shabbos
    ? "Shabbos"
    : new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(
        new Date(`${day.dateKey}T12:00:00`)
      );
  const borderColor =
    day.today || day.selected
      ? "border-[#009ee8]"
      : day.shabbos
        ? "border-[#a25bff]"
        : "border-[#aeb6bf]";

  return (
    <article
      className={`min-h-39 min-w-0 overflow-hidden border-2 bg-white ${borderColor} ${
        day.today || day.selected ? "bg-[#edf9ff]" : ""
      }`}
    >
      <header
        className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-1 overflow-hidden border-b px-2 py-1.5 ${
          day.shabbos
            ? "border-[#a25bff] bg-[#fcf8ff]"
            : "border-[#d6dde5] bg-[#f7f9fb]"
        }`}
      >
        <strong
          className={`min-w-0 truncate text-sm ${
            day.shabbos ? "text-[#8b37f5]" : "text-[#07162d]"
          }`}
          title={weekdayLabel}
        >
          {weekdayLabel}
        </strong>

        <div className="flex min-w-0 shrink-0 items-center gap-1">
          <PlusButton
            label={`Add kitchen event on ${day.dateLabel}`}
            onClick={() => onAddKitchenEvent(day.dateKey)}
          />
          <strong
            className={`whitespace-nowrap text-xs sm:text-sm ${
              day.shabbos ? "text-[#8b37f5]" : "text-[#07162d]"
            }`}
          >
            {day.dateLabel}
          </strong>
        </div>
      </header>

      <div className="min-w-0 space-y-1 p-2">
        {day.events?.map((event) => (
          <KitchenEventCard
            compact
            event={event}
            key={event.id}
            onSelect={onSelectEvent}
          />
        ))}
      </div>
    </article>
  );
}

export function FourWeeksView({
  days,
  onCurrent,
  onAddKitchenEvent,
  onSelectEvent,
  onNext,
  onPrevious
}: {
  days: KitchenDay[];
  onCurrent: () => void;
  onAddKitchenEvent: (dateKey: string) => void;
  onSelectEvent: (event: KitchenEvent) => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const controls = [
    { label: "Previous", onClick: onPrevious },
    { label: "Current", onClick: onCurrent },
    { label: "Next", onClick: onNext }
  ];

  return (
    <div>
      <div className="mb-3 grid w-full grid-cols-3 gap-2">
        {controls.map((control) => (
          <button
            className="h-11 min-w-0 border border-[#d6dde5] bg-white px-2 text-sm font-black hover:border-[#9eacbb] hover:bg-[#f6f8fa]"
            key={control.label}
            onClick={control.onClick}
            type="button"
          >
            {control.label}
          </button>
        ))}
      </div>

      <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-2">
        <div className="w-full min-w-256 bg-[#a9a9a9] p-1.5">
          <div className="grid grid-cols-7 gap-1.5">
            {days.map((day) => (
              <FourWeekDay
                day={day}
                key={day.dateKey}
                onAddKitchenEvent={onAddKitchenEvent}
                onSelectEvent={onSelectEvent}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
