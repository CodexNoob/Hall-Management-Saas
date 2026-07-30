"use client";

import { type KitchenEvent } from "@/features/kitchen/components/kitchen-shared";

export function KitchenEventDetailsDialog({
  event,
  onClose
}: {
  event: KitchenEvent | null;
  onClose: () => void;
}) {
  if (!event) {
    return null;
  }

  const hold = event.statusType === "hold";
  const productionItems = [
    {
      chef: "Mendy",
      name: "Challah Rolls",
      ratio: "1 tray per 50 portions",
      quantity: "4 trays needed"
    },
    {
      chef: "Mendy",
      name: "Gefilte Fish",
      ratio: "1 pan per 40 portions",
      quantity: "5 pans needed"
    },
    {
      chef: "Mendy",
      name: "Chicken Soup",
      ratio: "1 pot per 60 portions",
      quantity: "4 pots needed",
      urgent: true
    },
    {
      name: "Salad Topped with Salmon Cubes",
      ratio: "1 platter per 25 portions",
      quantity: "8 platters needed"
    },
    {
      name: "Vegetable Egg Roll on Sweet Potato Puree",
      ratio: "1 tray per 50 portions",
      quantity: "4 trays needed"
    },
    {
      name: "Chicken Capon Filled with Kishka",
      ratio: "1 pan per 30 portions",
      quantity: "7 pans needed"
    },
    {
      chef: "Yossi",
      name: "Potato Kugel",
      ratio: "1 tray per 50 portions",
      quantity: "4 trays needed",
      assigned: true
    },
    {
      name: "Roasted Vegetables",
      ratio: "1 tray per 60 portions",
      quantity: "4 trays needed"
    },
    {
      name: "Israeli Salad",
      ratio: "1 bowl per 40 portions",
      quantity: "5 bowls needed"
    },
    {
      name: "Assorted Dessert",
      ratio: "1 tray per 35 portions",
      quantity: "6 trays needed"
    },
    {
      name: "Cold Drinks",
      ratio: "1 case per 20 portions",
      quantity: "10 cases needed"
    }
  ];

  return (
    <div className="dashboard-drawer-backdrop fixed inset-0 z-100 flex items-center justify-center bg-[#07162d]/45 p-3 backdrop-blur-sm">
      <section
        aria-labelledby="kitchen-event-details-title"
        aria-modal="true"
        className="max-h-[calc(100dvh-24px)] w-full max-w-6xl overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-2xl shadow-[#07162d]/25"
        role="dialog"
      >
        <header className="flex items-start gap-3 border-b border-[#d8dde5] px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-wide text-[#617086]">
              Kitchen production details
            </p>
            <h2
              className="mt-1 truncate text-xl font-black text-[#07162d]"
              id="kitchen-event-details-title"
            >
              {event.title}
            </h2>
          </div>

          <button
            aria-label="Close kitchen event details"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-2xl leading-none text-[#17202a] transition hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="max-h-[calc(100dvh-104px)] overflow-y-auto bg-[#f5f6f8] p-4 sm:p-5">
          <div
            className={`mb-3 flex min-h-10 items-center justify-center rounded-lg px-4 text-center text-sm font-black uppercase tracking-wide text-white ${
              hold ? "bg-[#d88a00]" : "bg-[#1f4d73]"
            }`}
          >
            {event.status ?? (hold ? "On hold - not confirmed" : "Kitchen")}
          </div>

          <div className="grid gap-4 rounded-xl border border-[#d8dde5] bg-white p-4 lg:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="border-l-4 border-[#1f4d73] bg-[#f8fafc] p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#617086]">
                {event.category}
              </p>
              <h3 className="mt-4 text-3xl font-black leading-tight text-[#07162d]">
                {event.title}
              </h3>
              <p className="mt-4 text-2xl font-black text-[#07162d]">
                {event.portions}
              </p>
              <p className="mt-6 text-sm font-black uppercase tracking-wide text-[#617086]">
                {event.packageName}
              </p>
            </aside>

            <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {productionItems.map((item) => (
                <article
                  className={`min-h-34 border bg-white p-3 text-center shadow-sm ${
                    item.urgent
                      ? "border-[#d88a00] bg-[#fff6e8]"
                      : item.assigned
                        ? "border-[#1fa368] bg-[#effcf5]"
                        : "border-[#d8dde5]"
                  }`}
                  key={`${item.name}-${item.quantity}`}
                >
                  {item.chef ? (
                    <p
                      className={`mb-2 rounded-sm px-2 py-1 text-[10px] font-black text-white ${
                        item.assigned ? "bg-[#0f5132]" : "bg-[#07162d]"
                      }`}
                    >
                      {item.chef}
                    </p>
                  ) : null}

                  <h4 className="text-base font-black leading-tight text-[#07162d]">
                    {item.name}
                  </h4>
                  <p className="mt-2 text-[11px] font-black leading-tight text-[#617086]">
                    {item.ratio}
                  </p>
                  <p className="mt-3 border border-[#d8dde5] bg-[#eef4fa] px-2 py-1 text-xs font-black leading-tight text-[#07162d]">
                    {item.quantity}
                  </p>
                  {item.urgent ? (
                    <p className="mt-2 rounded-sm bg-[#d88a00] px-2 py-1 text-[10px] font-black text-white">
                      Chef approval needed
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
