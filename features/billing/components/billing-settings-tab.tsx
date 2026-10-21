"use client";

import { useState } from "react";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { useAppLanguage } from "@/components/providers/app-language-provider";

export function SettingsTab() {
  const { t } = useAppLanguage();
  const [businessName, setBusinessName] = useState("Event Core Hall");
  const [paymentTerms, setPaymentTerms] = useState("Due before event");
  const [invoiceFooter, setInvoiceFooter] = useState(
    t("billing.invoiceFooterDefault")
  );
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveSettings() {
    setSaving(true);
    setMessage("");
    try {
      const response = await authenticatedFetch("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          billing: { businessName, paymentTerms, invoiceFooter }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload.error ?? t("billing.settingsSaveFailed"));
      setMessage(t("billing.settingsSaved"));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : t("billing.settingsSaveFailed")
      );
    } finally {
      setSaving(false);
    }
  }
  const categories = [
    "Uncategorized",
    t("billing.catEventDeposit"),
    t("billing.catFinalPayment"),
    t("billing.catVendorCost"),
    t("billing.catFoodPurchase"),
    t("billing.catStaffPayroll"),
    t("billing.catLinenRental"),
    t("billing.catEquipmentRental"),
    "Utilities",
    "Repairs",
    "Refund",
    t("billing.catOfficeExpense")
  ];

  return (
    <div className="grid gap-4 p-4 xl:grid-cols-[1fr_1fr]">
      <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <div className="border-b border-[#d8dde5] p-4">
          <h2 className="font-black">{t("billing.invoiceSettings")}</h2>
          <p className="text-sm text-[#6a7483]">
            {t("billing.invoiceSettingsBlurb")}
          </p>
        </div>
        <div className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs font-black uppercase text-[#6a7483]">
              {t("billing.businessName")}
              <input
                className="mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm"
                value={businessName}
                onChange={(event) => setBusinessName(event.target.value)}
                name="businessName"
              />
            </label>
            <label className="text-xs font-black uppercase text-[#6a7483]">
              {t("billing.paymentTerms")}
              <select
                className="mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm"
                aria-label={t("billing.paymentTerms")}
                name="paymentTerms"
                value={paymentTerms}
                onChange={(event) => setPaymentTerms(event.target.value)}
                title={t("billing.paymentTerms")}
              >
                <option value="Due before event">{t("billing.dueBeforeEvent")}</option>
              </select>
            </label>
          </div>
          <label className="text-xs font-black uppercase text-[#6a7483]">
            {t("billing.invoiceFooter")}
            <textarea
              className="mt-1 h-24 w-full rounded-lg border border-[#b9c2cf] p-3 text-sm"
              value={invoiceFooter}
              onChange={(event) => setInvoiceFooter(event.target.value)}
              name="invoiceFooter"
            />
          </label>
          <button
            className="h-10 w-full rounded-lg bg-[#1f4d73] text-sm font-black text-white"
            type="button"
            disabled={saving}
            onClick={() => void saveSettings()}
          >
            {saving ? t("common.savingChar") : t("billing.saveSettings")}
          </button>
          {message ? (
            <p className="text-sm font-bold text-[#1f4d73]">{message}</p>
          ) : null}
        </div>
      </section>
      <section className="rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <div className="border-b border-[#d8dde5] p-4">
          <h2 className="font-black">{t("billing.bankAndCategories")}</h2>
          <p className="text-sm text-[#6a7483]">
            {t("billing.bankBlurb")}
          </p>
        </div>
        <div className="m-4 rounded-lg border border-[#1f4d73] bg-[#fbfcfd] p-3 text-sm text-[#1f4d73]">
          <p className="font-black">{t("billing.plaidFlow")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              {t("billing.plaidWhoConnects")}
            </li>
            <li>
              {t("billing.plaidNoCredentials")}
            </li>
            <li>
              {t("billing.plaidSeparated")}
            </li>
          </ul>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-[#6a7483]">
            <tr>
              <th className="border-y border-[#d8dde5] p-3">{t("common.category")}</th>
              <th className="border-y border-[#d8dde5] p-3">{t("common.type")}</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category, index) => (
              <tr key={category}>
                <td className="border-b border-[#d8dde5] p-3 font-black">
                  {category}
                </td>
                <td className="border-b border-[#d8dde5] p-3">
                  {index === 1 || index === 2 ? "Income" : t("billing.expenseGeneral")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
