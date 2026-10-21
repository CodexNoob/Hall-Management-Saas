"use client";

import { useRouter } from "next/navigation";

import { useDashboardAccess } from "@/features/dashboard/hooks/use-dashboard-permission";
import { isHiddenDashboardRoute } from "@/lib/ui/mvp-features";
import { useAppLanguage } from "@/components/providers/app-language-provider";
import type { MessageKey } from "@/lib/i18n/messages";

const moduleLinks = [
  {
    eyebrow: "Live",
    title: "Kitchen",
    descriptionKey: "dashboard.module.kitchenBlurb",
    actionLabelKey: "dashboard.module.openKitchen",
    route: "/dashboard/kitchen"
  },
  {
    eyebrow: "Booking",
    title: "Calendar",
    descriptionKey: "dashboard.module.calendarBlurb",
    actionLabelKey: "dashboard.module.openCalendar",
    route: "/dashboard/calendar"
  },
  {
    eyebrow: "Manage",
    title: "Events",
    descriptionKey: "dashboard.module.eventsBlurb",
    actionLabelKey: "dashboard.module.openEvents",
    route: "/dashboard/events"
  },
  {
    eyebrow: "Office",
    title: "Billing",
    descriptionKey: "dashboard.module.billingBlurb",
    actionLabelKey: "dashboard.module.openBilling",
    route: "/dashboard/billing"
  }
] satisfies Array<{
  eyebrow: string;
  title: string;
  descriptionKey: MessageKey;
  actionLabelKey: MessageKey;
  route: string;
}>;

export function DashboardModuleLinks() {
  const { t } = useAppLanguage();
  const router = useRouter();
  const { canAccessRoute } = useDashboardAccess();
  // Same filter as dashboard-sidebar.tsx's nav items, so a tile is offered
  // exactly when the sidebar would offer the same destination - which now means
  // the MVP gate as well as the permission one. See lib/ui/mvp-features.
  const visibleLinks = moduleLinks.filter(
    (item) => !isHiddenDashboardRoute(item.route) && canAccessRoute(item.route)
  );

  if (visibleLinks.length === 0) return null;

  return (
    <section
      aria-label={t("dashboard.moduleShortcuts")}
      className="mt-6 grid grid-flow-col auto-cols-[minmax(12rem,1fr)] gap-4 overflow-x-auto pb-6 pt-2"
    >
      {visibleLinks.map((item) => (
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
            {t(item.descriptionKey)}
          </p>
          <p className="mt-4 whitespace-nowrap text-sm font-black text-[#1f4d73]">
            {t(item.actionLabelKey)}
          </p>
        </button>
      ))}
    </section>
  );
}
