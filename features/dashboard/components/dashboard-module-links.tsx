"use client";

import { useRouter } from "next/navigation";

const moduleLinks = [
  {
    eyebrow: "Live",
    title: "Kitchen",
    description: "Menu production, quantities, workers, and completion status.",
    actionLabel: "Open kitchen board",
    route: "/dashboard/kitchen"
  },
  {
    eyebrow: "Booking",
    title: "Calendar",
    description: "Month view with room availability and closed-date rules.",
    actionLabel: "Open calendar",
    route: "/dashboard/calendar"
  },
  {
    eyebrow: "Manage",
    title: "Events",
    description: "Full event file: client, menu, dining, staff, vendors, files.",
    actionLabel: "Open event files",
    route: "/dashboard/events"
  },
  {
    eyebrow: "Office",
    title: "Billing",
    description: "Retainers, invoices, payment links, and balances due.",
    actionLabel: "Open billing",
    route: "/dashboard/billing"
  }
];

export function DashboardModuleLinks() {
  const router = useRouter();

  return (
    <section className="mt-6 grid grid-flow-col auto-cols-[minmax(12rem,1fr)] gap-4 overflow-x-auto pb-6 pt-2">
      {moduleLinks.map((item) => (
        <button
          key={item.title}
          className="min-h-38 rounded-2xl border border-[#d8dde5] bg-white p-4 text-left shadow-sm shadow-[#17202a]/4 transition hover:-translate-y-0.5 hover:border-[#1f4d73] hover:bg-[#fbfcfd] hover:shadow-md"
          type="button"
          onClick={() =>
            router.push(item.route as Parameters<typeof router.push>[0])
          }
        >
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6a7483]">
            {item.eyebrow}
          </p>
          <h3 className="mt-3 text-lg font-black text-[#17202a]">
            {item.title}
          </h3>
          <p className="mt-2 text-sm font-medium leading-6 text-[#6a7483]">
            {item.description}
          </p>
          <p className="mt-4 whitespace-nowrap text-sm font-black text-[#1f4d73]">
            {item.actionLabel}
          </p>
        </button>
      ))}
    </section>
  );
}
