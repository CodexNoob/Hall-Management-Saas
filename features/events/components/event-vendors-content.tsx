"use client";

import {
  Badge,
  LineIcon
} from "@/features/events/components/event-manager-shared";
import { useAppLanguage } from "@/components/providers/app-language-provider";

export function EventVendorsContent() {
  const { t } = useAppLanguage();
  const vendorRows = [
    {
      vendor: "Royal Linen",
      order: t("events.tableclothOrder"),
      status: "Pending",
      notes: t("events.needIvoryCount")
    },
    {
      vendor: "Sweet House",
      order: t("events.dessertCups"),
      status: "Confirmed",
      notes: t("events.deliveryTime")
    }
  ];

  return (
    <section className="min-h-107.5 min-w-0 overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-[#d8dde5] px-4 py-3">
        <div className="flex items-center gap-2">
          <LineIcon name="store" className="h-4 w-4 text-[#17202a]" />
          <h2 className="text-sm font-black text-[#17202a]">
            {t("events.vendorsForEvent")}
          </h2>
        </div>
      </header>

      <div className="overflow-x-auto p-3">
        <table className="w-full min-w-190 text-left text-sm">
          <thead className="bg-[#fbfcfd] text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
            <tr className="border-b border-[#d8dde5]">
              <th className="px-2 py-3">{t("events.vendor")}</th>
              <th className="px-2 py-3">{t("events.order")}</th>
              <th className="px-2 py-3">{t("common.status")}</th>
              <th className="px-2 py-3">{t("common.notes")}</th>
            </tr>
          </thead>
          <tbody className="text-[#17202a]">
            {vendorRows.map((row) => (
              <tr
                key={row.vendor}
                className="border-b border-[#d8dde5] last:border-b-0"
              >
                <td className="px-2 py-3 font-black">{row.vendor}</td>
                <td className="px-2 py-3">{row.order}</td>
                <td className="px-2 py-3">
                  <Badge tone={row.status === "Confirmed" ? "green" : "gold"}>
                    {row.status}
                  </Badge>
                </td>
                <td className="px-2 py-3">{row.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
