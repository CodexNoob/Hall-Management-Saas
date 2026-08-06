"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  Badge,
  LineIcon,
  portalChecklist,
  type EventFile
} from "@/features/events/components/event-manager-shared";
import { Field } from "@/features/events/components/event-details-panel";

function PortalOptionCard({
  title,
  price,
  selected = false,
  highlight = false
}: {
  title: string;
  price?: string;
  selected?: boolean;
  highlight?: boolean;
}) {
  return (
    <label className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3">
      <div
        className={`flex h-20 items-center justify-center rounded-lg border border-[#d8dde5] text-center text-xs font-black uppercase tracking-[0.08em] text-[#516174] ${highlight ? "bg-[#fff2b8]" : "bg-white"}`}
      >
        {title}
      </div>
      <div className="mt-3 flex items-start gap-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#516174]">
        <input
          className="mt-0.5 h-3.5 w-3.5"
          type={selected ? "radio" : "checkbox"}
          defaultChecked={selected}
          name={selected ? "menu-package" : "menu-item"}
        />
        <span>
          {title}
          {price ? (
            <span className="ml-0.5 text-[#17202a]">{price}</span>
          ) : null}
        </span>
      </div>
    </label>
  );
}

function LayoutPreview() {
  const gridStyle = {
    backgroundImage:
      "linear-gradient(#d8dde5 1px, transparent 1px), linear-gradient(90deg, #d8dde5 1px, transparent 1px)",
    backgroundSize: "22px 22px"
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-[#d8dde5] bg-white p-3 sm:p-4">
      <h2 className="text-sm font-black text-[#17202a]">Layout preview</h2>
      <div
        className="mt-3 min-w-0 rounded-lg border border-[#d8dde5] p-2 sm:p-8"
        style={gridStyle}
      >
        <div className="mx-auto grid min-w-0 max-w-96 grid-cols-4 gap-1 text-[9px] font-black sm:gap-0 sm:text-xs">
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
              className="flex h-11 items-center justify-center rounded-full border border-[#17202a] bg-white"
            >
              {table}
            </div>
          ))}
        </div>
        <div className="mx-auto my-2 h-2 max-w-100 rounded-full bg-[#17202a] text-center text-[10px] font-black leading-2 text-white">
          Mechitza
        </div>
        <div className="mx-auto mt-8 grid min-w-0 max-w-lg grid-cols-3 gap-2 text-[9px] font-black sm:mt-10 sm:gap-8 sm:text-xs">
          {["Buffet", "Head table", "Drinks"].map((label) => (
            <div
              key={label}
              className="flex h-11 items-center justify-center rounded-lg border border-[#17202a] bg-white"
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ClientPortalContent({ event }: { event: EventFile }) {
  const router = useRouter();
  const [portalUrl, setPortalUrl] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  return (
    <div className="grid min-w-0 gap-3 overflow-hidden xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-3">
        <section className="min-w-0 overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
          <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
            <LineIcon name="files" />
            <h2 className="text-sm font-black text-[#17202a]">
              Client sharing checklist
            </h2>
          </header>
          <div className="space-y-2 p-3">
            {portalChecklist.map(([label, shared]) => (
              <label
                key={label}
                className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-[#d8dde5] bg-white px-3 py-2 text-sm font-black text-[#17202a]"
              >
                <input
                  className="h-4 w-4 accent-[#1f4d73]"
                  type="checkbox"
                  defaultChecked={shared}
                  name={`portal-section-${label.toLowerCase().replaceAll(" ", "-")}`}
                />
                <span className="min-w-0 flex-1 leading-tight">{label}</span>
                <span className="shrink-0 text-xs font-medium text-[#6a7483]">
                  {shared ? "Shared" : "Hidden"}
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3">
          <h2 className="text-sm font-black text-[#17202a]">
            Client portal link
          </h2>
          <input
            className="mt-3 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm"
            readOnly
            value={portalUrl}
            name="clientPortalUrl"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className="inline-flex h-8 items-center gap-2 rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white"
              type="button"
              onClick={() =>
                setPortalUrl(`${window.location.origin}/client/${event.id}`)
              }
            >
              <LineIcon name="document" />
              Generate link
            </button>
            <button
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black"
              type="button"
              onClick={async () => {
                if (!portalUrl)
                  return setCopyMessage("Generate the link first.");
                await navigator.clipboard.writeText(portalUrl);
                setCopyMessage("Link copied.");
              }}
            >
              <LineIcon name="files" />
              Copy link
            </button>
            {copyMessage ? (
              <span
                className="self-center text-xs text-[#516174]"
                role="status"
              >
                {copyMessage}
              </span>
            ) : null}
          </div>
        </section>
      </aside>

      <section className="min-w-0 overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
        <header className="rounded-t-lg bg-[#1f4d73] p-4 text-white sm:p-6">
          <h1 className="break-words text-xl font-black sm:text-2xl">
            {event.title}
          </h1>
          <p className="mt-2 text-sm font-semibold">
            {event.date} - {event.time} - {event.room}
          </p>
        </header>
        <div className="min-w-0 space-y-3 p-3 sm:p-4">
          <section className="min-w-0 rounded-lg border border-[#d8dde5] p-3 sm:p-4">
            <h2 className="text-sm font-black">Event details</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3">
                <strong>Status</strong>
                <p className="mt-1 text-sm text-[#6a7483]">{event.status}</p>
              </div>
              <div className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3">
                <strong>Hall</strong>
                <p className="mt-1 text-sm text-[#6a7483]">{event.room}</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-[#d8dde5] p-4">
            <h2 className="text-sm font-black">Guest count</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                ["Couples", event.couples],
                ["Children", event.children],
                ["Extra guests", "0"]
              ].map(([label, value]) => (
                <Field key={label} label={label}>
                  <input
                    className="mt-1 h-9 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm font-medium text-[#17202a]"
                    defaultValue={value}
                    name={`dining-${label.toLowerCase().replaceAll(" ", "-")}`}
                  />
                </Field>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-[#d8dde5] p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black">Menu selection</h2>
              <Badge tone="green">client selectable</Badge>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <PortalOptionCard
                title="Standard dinner"
                price="Included"
                selected
              />
              <PortalOptionCard title="Premium dinner" price="$1,800.00" />
              <PortalOptionCard title="Gold dinner" price="$3,500.00" />
              <PortalOptionCard title="Dairy buffet" price="$1,200.00" />
            </div>
          </section>

          <section className="rounded-lg border border-[#d8dde5] p-4">
            <h2 className="text-sm font-black">Tablecloth options</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <PortalOptionCard title="Ivory linen" price="$300.00" />
              <PortalOptionCard title="White linen" price="Included" />
              <PortalOptionCard title="Gold runner" price="$450.00" highlight />
              <PortalOptionCard title="Velvet accent" price="$650.00" />
            </div>
          </section>

          <section className="rounded-lg border border-[#d8dde5] p-4">
            <h2 className="text-sm font-black">Add-ons</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <PortalOptionCard title="Coffee station" price="$350.00" />
              <PortalOptionCard title="Sweet table" price="$900.00" />
              <PortalOptionCard title="Extra buffet" price="$750.00" />
              <PortalOptionCard title="Late night snacks" price="$600.00" />
            </div>
          </section>

          <LayoutPreview />

          <section className="rounded-lg border border-[#d8dde5] p-4">
            <h2 className="text-sm font-black">Payment</h2>
            <button
              className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white"
              type="button"
              onClick={() => router.push("/dashboard/billing")}
            >
              <LineIcon name="document" />
              Pay balance
            </button>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-4">
            <span className="text-sm text-[#17202a]">
              Estimated client total
            </span>
            <strong className="text-xl text-[#17202a]">$55,200.00</strong>
          </div>
        </div>
      </section>
    </div>
  );
}
