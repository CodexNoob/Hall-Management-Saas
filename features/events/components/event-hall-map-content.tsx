"use client";

import { useRouter } from "next/navigation";

import { validPresetObjects } from "@/features/dining/components/dining-shared";
import {
  Badge,
  LineIcon,
  type EventFile
} from "@/features/events/components/event-manager-shared";

export function HallMapContent({ event }: { event: EventFile }) {
  const router = useRouter();
  const preset = event.diningHallMapPreset;
  const objects = validPresetObjects(preset?.objects);

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
              <LineIcon name="map" />
              <h2 className="text-sm font-black text-[#17202a]">
                Dining hall map
              </h2>
            </div>
            <button
              className="hidden h-8 shrink-0 items-center gap-2 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black hover:bg-[#eef4fa] md:inline-flex"
              type="button"
              onClick={() => router.push("/dashboard/dining-manager")}
            >
              <LineIcon name="fork" />
              Open dining
            </button>
          </header>
          <div className="space-y-3 p-3 text-sm leading-5 text-[#17202a]">
            {preset ? (
              <>
                <div className="rounded-lg border border-[#d8dde5] bg-[#f8fafc] p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#59677c]">
                    Saved preset
                  </p>
                  <p className="mt-1 text-sm font-black text-[#17202a]">
                    {preset.name}
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#617086]">
                    Pulled from the Dining Manager plan saved for this event.
                  </p>
                </div>
                <div className="rounded-lg border border-[#d8dde5] bg-white p-3 text-xs font-bold text-[#516174]">
                  {objects.length} saved map objects
                </div>
              </>
            ) : (
              <p>
                No Dining Manager hall map preset has been saved for this event
                yet.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-[#d8dde5] bg-white p-3 text-sm leading-5 text-[#17202a]">
          <span className="md:hidden">
            Hall map is view-only on phone screens. Use Dining Manager on a
            tablet, laptop, or desktop to adjust and save the dining layout.
          </span>
          <span className="hidden md:inline">
            This is a read-only event view of the Hall Map Preset selected in
            Dining Manager.
          </span>
        </section>

        <button
          className="hidden h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white hover:bg-[#15344f] md:inline-flex"
          type="button"
          onClick={() => router.push("/dashboard/dining-manager")}
        >
          <LineIcon name="fork" />
          Update in Dining Manager
        </button>
      </aside>

      <section className="min-w-0 overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
        <header className="flex items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <LineIcon name="map" />
            <h2 className="truncate text-sm font-black text-[#17202a]">
              {preset?.name ?? "Dining hall map"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex rounded-full border border-[#b9c2cf] bg-[#f5f6f8] px-2 py-1 text-[10px] font-black uppercase text-[#516174] md:hidden">
              View only
            </span>
            <Badge tone={preset ? "green" : "gold"}>
              {preset ? "Saved dining layout" : "Needs dining layout"}
            </Badge>
          </div>
        </header>
        <div className="px-4 pb-4">
          <div
            className="min-h-80 min-w-0 rounded-lg border border-[#d8dde5] p-3 sm:p-6"
            style={gridStyle}
          >
            {objects.length ? (
              <div className="relative mx-auto aspect-[760/520] w-full max-w-[760px]">
                {objects.map((object) => {
                  const isRound =
                    object.type === "round-table" ||
                    object.type === "kids-table" ||
                    object.type === "circle";
                  const isDivider = object.type === "divider";
                  const isServiceShape =
                    object.type === "buffet" || object.type === "drinks";

                  return (
                    <div
                      className={`absolute flex items-center justify-center overflow-hidden px-1 text-center text-[9px] font-black shadow-sm ${
                        isDivider
                          ? "rounded bg-[#344a60] text-white"
                          : "border bg-white"
                      } ${
                        isServiceShape
                          ? "border-dashed border-[#526c86]"
                          : "border-[#526c86]"
                      } ${isRound ? "rounded-full" : "rounded-lg"}`}
                      key={object.id}
                      style={{
                        left: `${(object.x / 760) * 100}%`,
                        top: `${(object.y / 520) * 100}%`,
                        width: `${(object.width / 760) * 100}%`,
                        height: `${(object.height / 520) * 100}%`,
                        transform: `rotate(${object.rotation}deg)`
                      }}
                    >
                      <span className="line-clamp-2">
                        {object.name || object.type}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-lg bg-white/80 p-6 text-center">
                <LineIcon name="map" className="h-8 w-8 text-[#8a94a3]" />
                <h3 className="mt-3 text-sm font-black text-[#17202a]">
                  No saved dining hall map yet
                </h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-[#617086]">
                  Select a Hall Map Preset in Dining Manager, save the dining
                  plan, then return here to view the exact event layout.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
