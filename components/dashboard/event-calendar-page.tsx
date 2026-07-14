"use client";

import { useMemo, useState } from "react";
import { DashboardTopbar } from "@/components/topbars/dashboard-topbar";

type CalendarStatus = "confirmed" | "hold" | "school";

type CalendarBooking = {
  id: number;
  day: number;
  title: string;
  hall: string;
  type: string;
  packageName?: string;
  status: CalendarStatus;
};

type CalendarDay = {
  day: number;
  hebrewDate: string;
  currentMonth: boolean;
  fullyBooked?: boolean;
};

const weekDays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const calendarDays: CalendarDay[] = [
  { day: 28, hebrewDate: "13 בתמוז", currentMonth: false },
  { day: 29, hebrewDate: "14 בתמוז", currentMonth: false },
  { day: 30, hebrewDate: "15 בתמוז", currentMonth: false },
  { day: 1, hebrewDate: "16 בתמוז", currentMonth: true, fullyBooked: true },
  { day: 2, hebrewDate: "17 בתמוז", currentMonth: true },
  { day: 3, hebrewDate: "18 בתמוז", currentMonth: true },
  { day: 4, hebrewDate: "19 בתמוז", currentMonth: true, fullyBooked: true },

  { day: 5, hebrewDate: "20 בתמוז", currentMonth: true },
  { day: 6, hebrewDate: "21 בתמוז", currentMonth: true },
  { day: 7, hebrewDate: "22 בתמוז", currentMonth: true },
  { day: 8, hebrewDate: "23 בתמוז", currentMonth: true },
  { day: 9, hebrewDate: "24 בתמוז", currentMonth: true },
  { day: 10, hebrewDate: "25 בתמוז", currentMonth: true },
  { day: 11, hebrewDate: "26 בתמוז", currentMonth: true },

  { day: 12, hebrewDate: "27 בתמוז", currentMonth: true },
  { day: 13, hebrewDate: "28 בתמוז", currentMonth: true },
  { day: 14, hebrewDate: "29 בתמוז", currentMonth: true },
  { day: 15, hebrewDate: "1 באב", currentMonth: true },
  { day: 16, hebrewDate: "2 באב", currentMonth: true },
  { day: 17, hebrewDate: "3 באב", currentMonth: true },
  { day: 18, hebrewDate: "4 באב", currentMonth: true, fullyBooked: true },

  { day: 19, hebrewDate: "5 באב", currentMonth: true },
  { day: 20, hebrewDate: "6 באב", currentMonth: true },
  { day: 21, hebrewDate: "7 באב", currentMonth: true },
  { day: 22, hebrewDate: "8 באב", currentMonth: true },
  { day: 23, hebrewDate: "9 באב", currentMonth: true },
  { day: 24, hebrewDate: "10 באב", currentMonth: true },
  { day: 25, hebrewDate: "11 באב", currentMonth: true },

  { day: 26, hebrewDate: "12 באב", currentMonth: true },
  { day: 27, hebrewDate: "13 באב", currentMonth: true },
  { day: 28, hebrewDate: "14 באב", currentMonth: true },
  { day: 29, hebrewDate: "15 באב", currentMonth: true },
  { day: 30, hebrewDate: "16 באב", currentMonth: true },
  { day: 31, hebrewDate: "17 באב", currentMonth: true },
  { day: 1, hebrewDate: "18 באב", currentMonth: false },
];

const bookings: CalendarBooking[] = [
  {
    id: 1,
    day: 8,
    title: "Friedman",
    hall: "Grand Hall",
    type: "Wedding",
    packageName: "Gold",
    status: "confirmed",
  },
  {
    id: 2,
    day: 11,
    title: "Klein",
    hall: "Nachlas Yehuda A",
    type: "Sheva Brachos",
    status: "hold",
  },
  {
    id: 3,
    day: 14,
    title: "Weiss",
    hall: "Terrace Room",
    type: "Bar Mitzvah",
    status: "confirmed",
  },
  {
    id: 4,
    day: 16,
    title: "School PTA",
    hall: "School Dining Room",
    type: "School event",
    status: "school",
  },
];

const halls = [
  "Grand Hall",
  "Nachlas Yehuda A",
  "Nachlas Yehuda B",
  "Terrace Room",
  "School Dining Room",
];

function CalendarIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <rect height="17" rx="2" width="18" x="3" y="4" />
      <path d="M8 2v4M16 2v4M3 9h18" />
    </svg>
  );
}

function BuildingIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M4 21h16M6 21V9l6-5 6 5v12M9 21v-7h6v7" />
    </svg>
  );
}

function SettingsIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1-2.8-2.8.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3v-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1 2.8-2.8.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3h4v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1 2.8 2.8-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.2v4h-.2a1.7 1.7 0 0 0-1.4 1Z" />
    </svg>
  );
}

function StatusDot({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-[#516071]">
      <span className={["h-2.5 w-2.5 rounded-full", color].join(" ")} />
      {label}
    </span>
  );
}

function EventPill({
  booking,
  onSelect,
}: {
  booking: CalendarBooking;
  onSelect: () => void;
}) {
  const colors: Record<CalendarStatus, string> = {
    confirmed:
      "border-[#b9ddcf] border-l-[#178151] bg-[#f5fbf8] text-[#17202a]",
    hold:
      "border-[#ead8bb] border-l-[#b66b00] bg-[#fffaf2] text-[#17202a]",
    school:
      "border-[#d2cff9] border-l-[#5649dd] bg-[#f8f7ff] text-[#17202a]",
  };

  return (
    <button
      className={[
        "flex w-full items-center gap-2 overflow-hidden rounded-md border border-l-4 px-2 py-1 text-left",
        colors[booking.status],
      ].join(" ")}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      type="button"
    >
      <strong className="min-w-0 flex-1 truncate text-[11px]">
        {booking.title}
      </strong>

      <span className="max-w-16 truncate text-[9px] text-[#6a7483]">
        {booking.hall.replace("Nachlas Yehuda", "NY")}
      </span>
    </button>
  );
}

export function EventCalendarPage() {
  const [activeTab, setActiveTab] = useState<
    "calendar" | "availability" | "settings"
  >("calendar");

  const [selectedDay, setSelectedDay] = useState(8);
  const [searchQuery, setSearchQuery] = useState("");
  const [hallFilter, setHallFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const filteredBookings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return bookings.filter((booking) => {
      const matchesSearch =
        !query ||
        [
          booking.title,
          booking.hall,
          booking.type,
          booking.packageName ?? "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesHall =
        hallFilter === "all" || booking.hall === hallFilter;

      const matchesStatus =
        statusFilter === "all" || booking.status === statusFilter;

      const matchesType =
        typeFilter === "all" || booking.type === typeFilter;

      return matchesSearch && matchesHall && matchesStatus && matchesType;
    });
  }, [hallFilter, searchQuery, statusFilter, typeFilter]);

  const selectedBookings = bookings.filter(
    (booking) => booking.day === selectedDay,
  );

  const selectedHallNames = selectedBookings.map(
    (booking) => booking.hall,
  );

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        title="Calendar"
        subtitle="Review hall availability, bookings, holds, and fully booked dates."
      />

      <nav className="shrink-0 overflow-x-auto border-b border-[#d8dde5] bg-white px-3 sm:px-5">
        <div className="flex min-w-max gap-2">
          <button
            className={`flex h-12 items-center gap-2 border-b-3 px-2 text-sm font-black ${
              activeTab === "calendar"
                ? "border-[#1f4d73] text-[#17202a]"
                : "border-transparent text-[#516071]"
            }`}
            onClick={() => setActiveTab("calendar")}
            type="button"
          >
            <CalendarIcon />
            Month Calendar
          </button>

          <button
            className={`flex h-12 items-center gap-2 border-b-3 px-2 text-sm font-black ${
              activeTab === "availability"
                ? "border-[#1f4d73] text-[#17202a]"
                : "border-transparent text-[#516071]"
            }`}
            onClick={() => setActiveTab("availability")}
            type="button"
          >
            <BuildingIcon />
            Availability
          </button>

          <button
            className={`flex h-12 items-center gap-2 border-b-3 px-2 text-sm font-black ${
              activeTab === "settings"
                ? "border-[#1f4d73] text-[#17202a]"
                : "border-transparent text-[#516071]"
            }`}
            onClick={() => setActiveTab("settings")}
            type="button"
          >
            <SettingsIcon />
            Settings
          </button>
        </div>
      </nav>

      <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {activeTab !== "calendar" ? (
          <div className="mx-auto flex min-h-72 max-w-[1700px] items-center justify-center rounded-xl border border-dashed border-[#b9c2cf] bg-white p-8 text-center">
            <div>
              <h2 className="text-xl font-black">
                {activeTab === "availability"
                  ? "Availability"
                  : "Calendar settings"}
              </h2>

              <p className="mt-2 text-sm text-[#6a7483]">
                This tab is ready for its next implementation phase.
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto grid max-w-[1800px] gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="min-w-0 overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
              <div className="flex flex-col gap-3 border-b border-[#d8dde5] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarIcon />
                    <h1 className="text-sm font-black">Month Calendar</h1>
                  </div>

                  <p className="mt-1 text-xs text-[#6a7483]">
                    Click a day to book or review the schedule.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <StatusDot
                    color="bg-[#178151]"
                    label="Confirmed"
                  />
                  <StatusDot color="bg-[#b66b00]" label="Hold" />
                  <StatusDot color="bg-[#5649dd]" label="School" />
                  <StatusDot
                    color="bg-[#aab5c3]"
                    label="Fully booked"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-xl font-black">July 2026</h2>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      className="h-9 rounded-lg border border-[#b9c2cf] px-3 text-xs font-black hover:bg-[#eef4fa]"
                      type="button"
                    >
                      Previous
                    </button>

                    <button
                      className="h-9 rounded-lg border border-[#b9c2cf] px-3 text-xs font-black hover:bg-[#eef4fa]"
                      onClick={() => setSelectedDay(8)}
                      type="button"
                    >
                      Today
                    </button>

                    <button
                      className="h-9 rounded-lg border border-[#b9c2cf] px-3 text-xs font-black hover:bg-[#eef4fa]"
                      type="button"
                    >
                      Next
                    </button>
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-[minmax(190px,2fr)_repeat(3,minmax(120px,1fr))]">
                  <input
                    className="h-10 min-w-0 rounded-lg border border-[#b9c2cf] px-3 text-sm outline-none focus:border-[#1f4d73]"
                    name="calendarSearch"
                    onChange={(event) =>
                      setSearchQuery(event.target.value)
                    }
                    placeholder="Search calendar"
                    type="search"
                    value={searchQuery}
                  />

                  <select
                    className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm"
                    name="calendarHallFilter"
                    onChange={(event) =>
                      setHallFilter(event.target.value)
                    }
                    value={hallFilter}
                  >
                    <option value="all">All halls</option>
                    {halls.map((hall) => (
                      <option key={hall} value={hall}>
                        {hall}
                      </option>
                    ))}
                  </select>

                  <select
                    className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm"
                    name="calendarStatusFilter"
                    onChange={(event) =>
                      setStatusFilter(event.target.value)
                    }
                    value={statusFilter}
                  >
                    <option value="all">All statuses</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="hold">Hold</option>
                    <option value="school">School</option>
                  </select>

                  <select
                    className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm"
                    name="calendarTypeFilter"
                    onChange={(event) =>
                      setTypeFilter(event.target.value)
                    }
                    value={typeFilter}
                  >
                    <option value="all">All types</option>
                    <option value="Wedding">Wedding</option>
                    <option value="Sheva Brachos">
                      Sheva Brachos
                    </option>
                    <option value="Bar Mitzvah">Bar Mitzvah</option>
                    <option value="School event">School event</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto px-3 pb-3">
                <div className="min-w-212.5 overflow-hidden rounded-xl border border-[#d8dde5]">
                  <div className="grid grid-cols-7 bg-[#fbfcfd]">
                    {weekDays.map((day) => (
                      <div
                        key={day}
                        className="border-r border-[#d8dde5] py-3 text-center text-[10px] font-black tracking-wider text-[#6a7483] last:border-r-0"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7">
                    {calendarDays.map((calendarDay, index) => {
                      const dayBookings = calendarDay.currentMonth
                        ? filteredBookings.filter(
                            (booking) =>
                              booking.day === calendarDay.day,
                          )
                        : [];

                      const isSelected =
                        calendarDay.currentMonth &&
                        calendarDay.day === selectedDay;

                      return (
                        <div
                          key={[calendarDay.day, index].join("-")}
                          className={`relative min-h-32 border-r border-t border-[#d8dde5] p-2 text-left transition nth-[7n]:border-r-0 ${
                            calendarDay.currentMonth
                              ? "bg-white hover:bg-[#f8fbfd]"
                              : "bg-[#f8f9fb] text-[#94a1b1]"
                          } ${
                            isSelected
                              ? "z-1 ring-2 ring-inset ring-[#a8ccec]"
                              : ""
                          }`}
                        >
                          <button
                            aria-label={`Select July ${calendarDay.day}, 2026`}
                            className="absolute inset-0 z-0 disabled:cursor-default"
                            disabled={!calendarDay.currentMonth}
                            onClick={() => setSelectedDay(calendarDay.day)}
                            type="button"
                          />

                          <div className="pointer-events-none relative z-1 flex items-start justify-between gap-2">
                            <strong className="text-sm">
                              {calendarDay.day}
                            </strong>

                            <span
                              className="text-[9px] font-semibold"
                              dir="rtl"
                            >
                              {calendarDay.hebrewDate}
                            </span>
                          </div>

                          <div className="relative z-1 mt-2 space-y-1">
                            {dayBookings.map((booking) => (
                              <EventPill
                                booking={booking}
                                key={booking.id}
                                onSelect={() =>
                                  setSelectedDay(booking.day)
                                }
                              />
                            ))}
                          </div>

                          {calendarDay.fullyBooked ? (
                            <span className="pointer-events-none absolute bottom-2 right-2 z-1 text-[9px] font-black text-[#516071]">
                              Fully booked
                            </span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <aside className="self-start overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-[#d8dde5] p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarIcon />
                    <h2 className="text-sm font-black">
                      Wed, Jul {selectedDay}, 2026
                    </h2>
                  </div>

                  <p className="mt-1 text-xs text-[#6a7483]">
                    {selectedBookings.length}{" "}
                    {selectedBookings.length === 1
                      ? "booking"
                      : "bookings"}{" "}
                    on this date
                  </p>
                </div>

                <button
                  className="h-9 shrink-0 rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white hover:bg-[#15344f]"
                  type="button"
                >
                  Book date
                </button>
              </div>

              <div className="space-y-3 p-3">
                {selectedBookings.map((booking) => (
                  <article
                    className="rounded-xl border border-[#1f4d73] bg-[#eef4fa] p-3"
                    key={booking.id}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d8dde5] bg-white text-[#1f4d73]">
                        ✓
                      </span>

                      <div className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">
                          {booking.title}
                        </strong>

                        <p className="mt-1 truncate text-xs text-[#6a7483]">
                          {booking.hall} · {booking.type}
                          {booking.packageName
                            ? ` · ${booking.packageName}`
                            : ""}
                        </p>
                      </div>

                      <span className="rounded-full border border-[#b9ddcf] bg-white px-2 py-1 text-[9px] font-black text-[#178151]">
                        Confirmed
                      </span>
                    </div>
                  </article>
                ))}

                {halls.map((hall) => {
                  const booked = selectedHallNames.includes(hall);
                  const booking = selectedBookings.find(
                    (item) => item.hall === hall,
                  );

                  return (
                    <article
                      className={`rounded-xl border p-3 ${
                        booked
                          ? "border-[#ebc7bd] bg-[#fff7f4]"
                          : "border-[#b9ddcf] bg-[#f5fbf8]"
                      }`}
                      key={hall}
                    >
                      <h3 className="text-sm font-black">{hall}</h3>

                      <p className="mt-2 text-xs text-[#6a7483]">
                        {booked
                          ? "Booked by " + booking?.title
                          : "Available"}
                      </p>
                    </article>
                  );
                })}
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
