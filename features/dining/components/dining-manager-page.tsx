"use client";

import { useState, type ReactNode } from "react";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";

type DiningEvent = {
  id: string;
  name: string;
  hall: string;
  schedule: string;
  portions: string;
  status: string;
  tablecloth: string;
};

const diningEvents: DiningEvent[] = [
  {
    id: "rosenberg",
    name: "Rosenberg Bar Mitzvah",
    hall: "Grand Hall",
    schedule: "Monday, June 22 · 5:30 PM",
    portions: "240 portions",
    status: "Confirmed",
    tablecloth: "Ivory",
  },
  {
    id: "klein",
    name: "Klein Sheva Brachos",
    hall: "Nachlas Yehuda A",
    schedule: "Monday, June 22 · 6:15 PM",
    portions: "96 couples",
    status: "Menu locked",
    tablecloth: "White",
  },
  {
    id: "levy",
    name: "Levy Lchaim",
    hall: "Terrace Room",
    schedule: "Wednesday, June 24 · 7:00 PM",
    portions: "160 portions",
    status: "Hold",
    tablecloth: "Champagne",
  },
  {
    id: "friedman",
    name: "Friedman Dinner",
    hall: "Small Hall",
    schedule: "Monday, June 29 · 8:30 PM",
    portions: "72 couples",
    status: "Balance due",
    tablecloth: "Ivory",
  },
];

const tables = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1,
  seats: 10,
}));

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-[#d8dde5] bg-white ${className}`}
    >
      {children}
    </section>
  );
}

function FieldLabel({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <label
      className="mb-1 block text-[10px] font-black uppercase tracking-wider text-[#59677c]"
      htmlFor={htmlFor}
    >
      {children}
    </label>
  );
}

function SeatingRow({
  current,
  label,
  maximum,
  note,
  color,
}: {
  current: number;
  label: string;
  maximum: number;
  note: string;
  color: string;
}) {
  const percentage = Math.min((current / maximum) * 100, 100);

  return (
    <div>
      <div className="flex items-center gap-3">
        <strong className="w-14 shrink-0 text-xs">{label}</strong>

        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[#e7edf3]">
          <div
            className={`h-full rounded-full ${color}`}
            style={{ width: `${percentage}%` }}
          />
        </div>

        <span className="w-11 shrink-0 text-right text-[10px] text-[#36465a]">
          {current}/{maximum}
        </span>
      </div>

      <p className="mt-1 text-[10px] text-[#617086]">{note}</p>
    </div>
  );
}

function EventCard({
  event,
  selected,
  onSelect,
}: {
  event: DiningEvent;
  selected: boolean;
  onSelect: () => void;
}) {
  const warning = event.status !== "Confirmed";

  return (
    <button
      className={`w-full rounded-xl border p-3 text-left transition ${
        selected
          ? "border-[#1f5f91] bg-[#eef6fc]"
          : "border-[#c9d2de] bg-white hover:bg-[#f8fafc]"
      }`}
      onClick={onSelect}
      type="button"
    >
      <strong className="block text-sm font-black">{event.name}</strong>

      <p className="mt-1 text-xs leading-5 text-[#55708d]">
        {event.hall} · {event.schedule} · {event.portions}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${
            warning
              ? "border-[#efc879] bg-[#fff7e7] text-[#925200]"
              : "border-[#b9ddcf] bg-[#effbf6] text-[#087047]"
          }`}
        >
          {event.status}
        </span>

        <span className="rounded-full border border-[#d8dde5] bg-white px-2 py-0.5 text-[10px] font-black">
          {event.tablecloth}
        </span>
      </div>
    </button>
  );
}

function DiningTable({
  number,
  seats,
}: {
  number: number;
  seats: number;
}) {
  return (
    <button
      aria-label={`Table ${number}, ${seats} seats`}
      className="flex h-14 w-14 flex-col items-center justify-center rounded-full border border-[#526c86] bg-white text-center shadow-sm transition hover:border-[#1f4d73] hover:bg-[#eef6fc] sm:h-17 sm:w-17"
      type="button"
    >
      <strong className="text-[11px]">Table {number}</strong>
      <span className="text-[9px]">{seats} seats</span>
    </button>
  );
}

export function DiningManagerPage() {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    diningEvents[0].id,
  );

  const selectedEvent =
    diningEvents.find((event) => event.id === selectedEventId) ??
    diningEvents[0];

  return (
    <div className="flex h-dvh min-h-0 w-full max-w-full flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        title="Dining Manager"
        subtitle="Select an event, adjust the hall layout, and prepare the dining sheet."
        showSearch={false}
        compactMobileActions
        actionsSlot={
          <>
            <button
              aria-label="Clear selection"
              className="flex h-9 w-8 items-center justify-center bg-transparent text-[#17202a] hover:text-[#1f4d73] lg:h-11 lg:w-auto lg:rounded-xl lg:border lg:border-[#b9c2cf] lg:bg-white lg:px-4 lg:text-sm lg:font-bold lg:shadow-sm lg:hover:bg-[#eef4fa]"
              onClick={() => setSelectedEventId(null)}
              title="Clear selection"
              type="button"
            >
              <svg aria-hidden="true" className="h-6 w-6 lg:hidden" fill="none" viewBox="0 0 24 24"><path d="M5 5 19 19M19 5 5 19" stroke="currentColor" strokeLinecap="round" strokeWidth="2" /></svg>
              <span className="hidden lg:inline">Clear selection</span>
            </button>
            <button
              aria-label="Save layout"
              className="flex h-9 w-8 items-center justify-center bg-transparent text-[#1f4d73] hover:text-[#15344f] lg:h-11 lg:w-auto lg:rounded-xl lg:bg-[#1f4d73] lg:px-4 lg:text-sm lg:font-bold lg:text-white lg:shadow-sm lg:hover:bg-[#15344f]"
              title="Save layout"
              type="button"
            >
              <svg aria-hidden="true" className="h-6 w-6 lg:hidden" fill="none" viewBox="0 0 24 24"><path d="M5 4h12l2 2v14H5ZM8 4v6h8V4M8 20v-6h8v6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
              <span className="hidden lg:inline">Save layout</span>
            </button>
          </>
        }
      />

      <main className="min-h-0 w-full min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto px-2 pb-2 pt-4 sm:p-3">
        <div className="mx-auto grid min-h-full w-full min-w-0 max-w-[1800px] gap-3 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[258px_minmax(500px,1fr)_304px]">
          <Panel className="min-w-0">
            <header className="border-b border-[#d8dde5] px-3 py-2">
              <h2 className="text-sm font-black">Events</h2>
              <p className="mt-1 text-xs text-[#617086]">
                Open an event workspace.
              </p>
            </header>

            <div className="space-y-2 p-2">
              {diningEvents.map((event) => (
                <EventCard
                  event={event}
                  key={event.id}
                  onSelect={() => setSelectedEventId(event.id)}
                  selected={selectedEventId === event.id}
                />
              ))}
            </div>
          </Panel>

          <Panel className="flex min-h-125 min-w-0 flex-col sm:min-h-155">
            <header className="border-b border-[#d8dde5] p-2.5">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-black text-[#17202a]">
                  {selectedEvent.name}
                </h2>
                <p className="mt-1 truncate text-[11px] font-semibold text-[#617086]">
                  {selectedEvent.hall} · {selectedEvent.schedule} · {selectedEvent.portions}
                </p>
              </div>

              <div className="mt-2 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-[minmax(140px,1fr)_auto_auto]">
                <select
                aria-label="Dining hall"
                className="col-span-2 h-8 min-w-0 rounded-lg border border-[#b9c2cf] bg-white px-2 text-xs font-semibold sm:col-span-1"
                defaultValue={selectedEvent.hall}
                key={selectedEvent.id}
                name="diningHall"
              >
                <option>Grand Hall</option>
                <option>Nachlas Yehuda A</option>
                <option>Nachlas Yehuda B</option>
                <option>Terrace Room</option>
                <option>Small Hall</option>
                </select>

              <button
                className="h-8 min-w-0 whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-2 text-[10px] font-black hover:bg-[#eef4fa] sm:px-3"
                type="button"
              >
                Load preset
              </button>

              <button
                className="h-8 min-w-0 whitespace-nowrap rounded-lg bg-[#1f4d73] px-2 text-[10px] font-black text-white hover:bg-[#15344f] sm:px-4"
                type="button"
              >
                Save preset
              </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-auto p-2">
              <div
                className="relative min-h-105 w-full min-w-0 overflow-hidden rounded-lg border border-[#bdc9d6] bg-[#fbfdff] sm:min-h-133.75"
                style={{
                  backgroundImage:
                    "linear-gradient(#dce5ef 1px, transparent 1px), linear-gradient(90deg, #dce5ef 1px, transparent 1px)",
                  backgroundPosition: "-1px -1px",
                  backgroundSize: "21px 21px",
                }}
              >
                <div className="mx-auto mt-12 grid w-full max-w-78.75 grid-cols-4 justify-items-center gap-x-1 gap-y-5 px-2 sm:mt-19 sm:gap-x-5 sm:gap-y-8 sm:px-0">
                  {tables.map((table) => (
                    <DiningTable
                      key={table.id}
                      number={table.id}
                      seats={table.seats}
                    />
                  ))}
                </div>

                <div className="mx-auto mt-4 flex h-5 w-[calc(100%-1rem)] max-w-82.5 items-center justify-center rounded bg-[#344a60] text-[10px] font-black text-white">
                  Mechitza
                </div>

                <div className="mx-auto mt-8 grid w-full max-w-100.5 grid-cols-3 items-center gap-2 px-2 sm:mt-10 sm:grid-cols-[1fr_114px_1fr] sm:gap-10 sm:px-0">
                  <button
                    className="h-11 rounded-lg border border-dashed border-[#415d78] bg-[#f4f8fb] text-[10px] font-black"
                    type="button"
                  >
                    Buffet
                  </button>

                  <button
                    className="h-11 rounded-lg border border-[#415d78] bg-white text-[10px] font-black"
                    type="button"
                  >
                    Head table
                    <span className="block text-[9px] font-medium">
                      12 seats
                    </span>
                  </button>

                  <button
                    className="h-11 rounded-lg border border-dashed border-[#415d78] bg-[#f4f8fb] text-[10px] font-black"
                    type="button"
                  >
                    Drinks
                  </button>
                </div>
              </div>
            </div>
          </Panel>

          <Panel className="min-w-0 lg:col-span-2 xl:col-span-1">
            <header className="border-b border-[#d8dde5] px-3 py-2">
              <h2 className="text-sm font-black">Dining details</h2>
              <p className="mt-1 text-xs text-[#617086]">
                Event-specific setup.
              </p>
            </header>

            <form className="space-y-3 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel htmlFor="count-type">
                    Count type
                  </FieldLabel>

                  <select
                    className="h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-2 text-sm"
                    defaultValue="People"
                    id="count-type"
                    name="countType"
                  >
                    <option>People</option>
                    <option>Couples</option>
                  </select>
                </div>

                <div>
                  <FieldLabel htmlFor="adult-count">Adults</FieldLabel>

                  <input
                    className="h-9 w-full rounded-lg border border-[#b9c2cf] px-2 text-sm"
                    defaultValue="214"
                    id="adult-count"
                    min="0"
                    name="adultCount"
                    type="number"
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="children-count">
                    Children
                  </FieldLabel>

                  <input
                    className="h-9 w-full rounded-lg border border-[#b9c2cf] px-2 text-sm"
                    defaultValue="26"
                    id="children-count"
                    min="0"
                    name="childrenCount"
                    type="number"
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="men-waiters">
                    Men waiters
                  </FieldLabel>

                  <input
                    className="h-9 w-full rounded-lg border border-[#b9c2cf] px-2 text-sm"
                    defaultValue="8"
                    id="men-waiters"
                    min="0"
                    name="menWaiters"
                    type="number"
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="ladies-waiters">
                    Ladies waiters
                  </FieldLabel>

                  <input
                    className="h-9 w-full rounded-lg border border-[#b9c2cf] px-2 text-sm"
                    defaultValue="6"
                    id="ladies-waiters"
                    min="0"
                    name="ladiesWaiters"
                    type="number"
                  />
                </div>

                <div>
                  <FieldLabel htmlFor="tablecloth">
                    Tablecloth
                  </FieldLabel>

                  <select
                    className="h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-2 text-sm"
                    defaultValue="Ivory"
                    id="tablecloth"
                    name="tablecloth"
                  >
                    <option>Ivory</option>
                    <option>White</option>
                    <option>Champagne</option>
                    <option>Black</option>
                  </select>
                </div>

                <div>
                  <FieldLabel htmlFor="washing-time">
                    Washing time
                  </FieldLabel>

                  <input
                    className="h-9 w-full rounded-lg border border-[#b9c2cf] px-2 text-sm"
                    defaultValue="21:45"
                    id="washing-time"
                    name="washingTime"
                    type="time"
                  />
                </div>
              </div>

              <section className="rounded-xl border border-[#d8dde5] bg-[#fbfcfd] p-2">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-[#59677c]">
                  Seating check
                </h3>

                <div className="mt-2 space-y-2">
                  <SeatingRow
                    color="bg-[#b53737]"
                    current={80}
                    label="Men"
                    maximum={107}
                    note="8 tables placed · minimum 11 needed"
                  />

                  <SeatingRow
                    color="bg-[#c0a048]"
                    current={12}
                    label="Women"
                    maximum={107}
                    note="1 table placed · minimum 11 needed"
                  />

                  <SeatingRow
                    color="bg-[#6285a4]"
                    current={0}
                    label="Kids"
                    maximum={26}
                    note="0 tables placed · minimum 4 needed"
                  />
                </div>

                <p className="mt-2 text-[10px] font-bold text-[#59677c]">
                  Needs more seating: men side, women side, kids tables.
                </p>

                <p className="mt-1 text-[9px] leading-4 text-[#617086]">
                  Adult tables are split by the mechitza. Kids are counted
                  only on tables marked Kids.
                </p>

                <div className="mt-2 grid grid-cols-2 gap-2 xl:grid-cols-1">
                  <button
                    className="h-8 min-w-0 whitespace-nowrap rounded-lg border border-[#b9c2cf] bg-white px-1.5 text-[9px] font-black hover:bg-[#eef4fa] sm:px-2 sm:text-[10px]"
                    type="button"
                  >
                    Check seating
                  </button>

                  <button
                    className="h-8 min-w-0 whitespace-nowrap rounded-lg bg-[#1f4d73] px-1.5 text-[9px] font-black text-white hover:bg-[#15344f] sm:px-2 sm:text-[10px]"
                    type="button"
                  >
                    Add required tables
                  </button>
                </div>
              </section>

              <div>
                <FieldLabel htmlFor="special-notes">
                  Special notes
                </FieldLabel>

                <textarea
                  className="min-h-11 w-full resize-y rounded-lg border border-[#b9c2cf] px-2 py-2 text-xs"
                  defaultValue="Reserved family tables near the front section."
                  id="special-notes"
                  name="specialNotes"
                />
              </div>
            </form>
          </Panel>
        </div>
      </main>
    </div>
  );
}
