"use client";

import { useRouter } from "next/navigation";

import {
  Badge,
  LineIcon
} from "@/features/events/components/event-manager-shared";

export function HallMapContent() {
  const router = useRouter();
  const layoutRows = [
    ["03:00 PM", "Setup layout"],
    ["06:30 PM", "Guest arrival layout"],
    ["08:00 PM", "Dinner service layout"]
  ];

  const gridStyle = {
    backgroundImage:
      "linear-gradient(#d8dde5 1px, transparent 1px), linear-gradient(90deg, #d8dde5 1px, transparent 1px)",
    backgroundSize: "22px 22px"
  };

  return (
    <div className="grid min-w-0 gap-3 overflow-hidden xl:grid-cols-[310px_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-3">
        <section className="rounded-lg border border-[#d8dde5] bg-white">
          <header className="flex items-center justify-between gap-3 border-b border-[#d8dde5] px-4 py-3">
            <div className="flex items-center gap-2">
              <LineIcon name="clock" />
              <h2 className="text-sm font-black text-[#17202a]">
                Timeline layouts
              </h2>
            </div>
            <button
              className="hidden h-8 shrink-0 items-center gap-2 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black hover:bg-[#eef4fa] md:inline-flex"
              type="button"
              onClick={() => router.push("/dashboard/hall-room-map")}
            >
              <LineIcon name="plus" />
              Add layout
            </button>
          </header>
          <div className="space-y-2 p-3">
            {layoutRows.map(([time, label], index) => (
              <button
                key={time}
                className={`grid w-full grid-cols-[104px_minmax(0,1fr)] gap-2 rounded-lg border p-2 text-left max-md:pointer-events-none max-md:cursor-default ${
                  index === 0
                    ? "border-[#1f4d73] bg-[#eef4fa]"
                    : "border-[#d8dde5] bg-white hover:bg-[#fbfcfd]"
                }`}
                type="button"
                onClick={() => router.push("/dashboard/hall-room-map")}
              >
                <span className="flex h-9 items-center justify-between rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm">
                  {time}
                  <LineIcon name="clock" className="h-3.5 w-3.5" />
                </span>
                <span className="flex h-9 min-w-0 items-center rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm">
                  <span className="truncate">{label}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-[#d8dde5] bg-white p-3 text-sm leading-5 text-[#17202a]">
          <span className="md:hidden">
            Hall map is view-only on phone screens. Use a tablet, laptop, or
            desktop to edit the layout.
          </span>
          <span className="hidden md:inline">
            Edit the timing or layout name here. To change the actual room
            layout, open the official Hall Map editor.
          </span>
        </section>

        <button
          className="hidden h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white hover:bg-[#15344f] md:inline-flex"
          type="button"
          onClick={() => router.push("/dashboard/hall-room-map")}
        >
          <LineIcon name="map" />
          Edit layout
        </button>
      </aside>

      <section className="min-w-0 overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
        <header className="flex items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-2">
            <LineIcon name="map" />
            <h2 className="text-sm font-black text-[#17202a]">Setup layout</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full border border-[#b9c2cf] bg-[#f5f6f8] px-2 py-1 text-[10px] font-black uppercase text-[#516174] md:hidden">
              View only
            </span>
            <Badge tone="gold">Needs final review</Badge>
          </div>
        </header>
        <div className="px-4 pb-4">
          <div
            className="min-h-80 min-w-0 rounded-lg border border-[#d8dde5] p-3 sm:p-12"
            style={gridStyle}
          >
            <div className="mx-auto grid min-w-0 max-w-md grid-cols-4 gap-2 text-[9px] font-black sm:gap-x-4 sm:gap-y-6 sm:text-xs">
              {[
                "Table 1",
                "Table 2",
                "Table 5",
                "Table 6",
                "Table 3",
                "Table 4",
                "Table 7",
                "Table 8"
              ].map((table) => (
                <div
                  key={table}
                  className="flex h-12 items-center justify-center rounded-full border border-[#17202a] bg-white"
                >
                  {table}
                </div>
              ))}
            </div>
            <div className="mx-auto my-10 h-2 max-w-md rounded-full bg-[#17202a] text-center text-[10px] font-black leading-2 text-white">
              Mechitza
            </div>
            <div className="mx-auto mt-12 grid min-w-0 max-w-2xl grid-cols-3 gap-2 text-[9px] font-black sm:mt-20 sm:gap-24 sm:text-xs">
              {["Buffet", "Head table", "Drinks"].map((label) => (
                <div
                  key={label}
                  className="flex h-9 items-center justify-center rounded-lg border border-[#17202a] bg-white"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
          <button
            className="mt-3 hidden h-8 items-center gap-2 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black hover:bg-[#eef4fa] md:inline-flex"
            type="button"
            onClick={() => router.push("/dashboard/hall-room-map")}
          >
            <LineIcon name="check" />
            Confirm hall map
          </button>
        </div>
      </section>
    </div>
  );
}
