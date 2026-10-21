"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent
} from "react";
import type { BillingResponse } from "@/features/billing/components/billing-shared";
import { moneySchema, parseNumericInput } from "@/lib/validation/number";
import { useAppLanguage } from "@/components/providers/app-language-provider";

export type NewInvoiceFormValues = {
  eventId: string;
  clientName: string;
  status: "Draft" | "Sent";
  dueDate: string;
  firstItem: string;
  amount: string;
};

type Props = {
  events: BillingResponse["events"];
  open: boolean;
  onClose: () => void;
  onSave: (values: NewInvoiceFormValues) => Promise<void>;
};

const controlClass =
  "mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none transition focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15";

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function NewInvoiceDialog({ events, open, onClose, onSave }: Props) {
  const { t } = useAppLanguage();
  const titleId = useId();
  const firstControlRef = useRef<HTMLSelectElement>(null);
  const initialValues = useMemo<NewInvoiceFormValues>(() => {
    const event = events[0];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    return {
      eventId: event?.id ?? "",
      clientName: event?.clientName ?? "",
      status: "Draft",
      dueDate: dateInputValue(dueDate),
      firstItem: t("billing.eventPackage"),
      amount: event?.amountDue ? String(event.amountDue) : ""
    };
    // `t` is a dependency because the default line-item description is drawn
    // from the catalog: an operator working in Spanish should get a Spanish
    // default to edit, not an English one.
  }, [events, t]);
  const [values, setValues] = useState(initialValues);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setError("");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => firstControlRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [initialValues, onClose, open]);

  if (!open) return null;

  const update = <K extends keyof NewInvoiceFormValues>(
    field: K,
    value: NewInvoiceFormValues[K]
  ) => setValues((current) => ({ ...current, [field]: value }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!values.eventId)
      return setError(t("billing.createEventFirst"));

    const parsedAmount = parseNumericInput(
      values.amount,
      moneySchema({ label: t("common.amount"), t }),
      t
    );
    if (parsedAmount.status === "invalid") return setError(parsedAmount.message);
    if (parsedAmount.status === "empty" || parsedAmount.value <= 0)
      return setError(t("billing.amountGreaterThanZero"));
    setIsSaving(true);
    try {
      await onSave(values);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : t("billing.createInvoiceFailed")
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-[#17202a]/30 p-3"
      onMouseDown={(event) =>
        event.currentTarget === event.target && !isSaving && onClose()
      }
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[calc(100dvh-24px)] w-full max-w-3xl overflow-y-auto rounded-xl border border-[#d8dde5] bg-white shadow-2xl"
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-[#d8dde5] px-4 py-3">
          <div>
            <h2 className="font-black" id={titleId}>
              {t("billing.newInvoice")}
            </h2>
            <p className="text-sm text-[#6a7483]">
              {t("billing.invoiceFromEvent")}
            </p>
          </div>
          <button
            aria-label={t("billing.closeNewInvoice")}
            className="h-10 w-10 rounded-full text-2xl hover:bg-[#eef4fa]"
            disabled={isSaving}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
            <label className="text-xs font-black uppercase text-[#64748b]">
              {t("common.event")}
              <select
                className={controlClass}
                disabled={!events.length}
                id="invoice-event"
                name="eventId"
                onChange={(event) => {
                  const selected = events.find(
                    (item) => item.id === event.target.value
                  );
                  setValues((current) => ({
                    ...current,
                    eventId: event.target.value,
                    clientName: selected?.clientName ?? "",
                    amount: selected?.amountDue
                      ? String(selected.amountDue)
                      : current.amount
                  }));
                }}
                ref={firstControlRef}
                required
                value={values.eventId}
              >
                {!events.length ? (
                  <option value="">{t("billing.noEventsAvailable")}</option>
                ) : null}
                {events.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.clientName} —{" "}
                    {new Date(item.eventDate).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-black uppercase text-[#64748b]">
              {t("common.client")}
              <input
                className={`${controlClass} bg-[#f5f6f8]`}
                id="invoice-client-name"
                name="clientName"
                readOnly
                value={values.clientName}
              />
            </label>
            <label className="text-xs font-black uppercase text-[#64748b]">
              {t("common.status")}
              <select
                className={controlClass}
                id="invoice-status"
                name="status"
                onChange={(event) =>
                  update("status", event.target.value as "Draft" | "Sent")
                }
                value={values.status}
              >
                <option value="Draft">{t("billing.statusDraft")}</option>
                <option value="Sent">{t("billing.statusSent")}</option>
              </select>
            </label>
            <label className="text-xs font-black uppercase text-[#64748b]">
              {t("billing.dueDate")}
              <input
                className={controlClass}
                id="invoice-due-date"
                min={dateInputValue(new Date())}
                name="dueDate"
                onChange={(event) => update("dueDate", event.target.value)}
                required
                type="date"
                value={values.dueDate}
              />
            </label>
            <label className="text-xs font-black uppercase text-[#64748b]">
              {t("billing.lineItem")}
              <input
                className={controlClass}
                id="invoice-first-item"
                name="firstItem"
                onChange={(event) => update("firstItem", event.target.value)}
                required
                value={values.firstItem}
              />
            </label>
            <label className="text-xs font-black uppercase text-[#64748b]">
              {t("common.amount")}
              <input
                className={controlClass}
                id="invoice-amount"
                inputMode="decimal"
                name="amount"
                onChange={(event) => update("amount", event.target.value)}
                required
                type="text"
                value={values.amount}
              />
            </label>
            {error ? (
              <p
                className="sm:col-span-2 rounded-lg bg-[#fff1f0] px-3 py-2 text-sm font-semibold text-[#a62b24]"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </div>
          <footer className="flex justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-4 py-3">
            <button
              className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-4 text-sm font-black"
              disabled={isSaving}
              onClick={onClose}
              type="button"
            >
              {t("common.cancel")}
            </button>
            <button
              className="h-10 rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white disabled:opacity-60"
              disabled={isSaving || !events.length}
              type="submit"
            >
              {isSaving ? t("billing.creating") : t("billing.createInvoice")}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
