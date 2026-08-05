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

export type NewInvoiceFormValues = {
  eventId: string;
  clientName: string;
  status: "Draft" | "Open";
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
      firstItem: "Event package",
      amount: event?.amountDue ? String(event.amountDue) : ""
    };
  }, [events]);
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
      return setError("Create an event before creating an invoice.");
    if (!Number.isFinite(Number(values.amount)) || Number(values.amount) <= 0)
      return setError("Enter an amount greater than zero.");
    setIsSaving(true);
    try {
      await onSave(values);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to create invoice."
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
              New invoice
            </h2>
            <p className="text-sm text-[#6a7483]">
              Create an invoice from an existing event.
            </p>
          </div>
          <button
            aria-label="Close new invoice"
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
              Event
              <select
                className={controlClass}
                disabled={!events.length}
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
                  <option value="">No events available</option>
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
              Client
              <input
                className={`${controlClass} bg-[#f5f6f8]`}
                readOnly
                value={values.clientName}
              />
            </label>
            <label className="text-xs font-black uppercase text-[#64748b]">
              Status
              <select
                className={controlClass}
                onChange={(event) =>
                  update("status", event.target.value as "Draft" | "Open")
                }
                value={values.status}
              >
                <option>Draft</option>
                <option>Open</option>
              </select>
            </label>
            <label className="text-xs font-black uppercase text-[#64748b]">
              Due date
              <input
                className={controlClass}
                min={dateInputValue(new Date())}
                onChange={(event) => update("dueDate", event.target.value)}
                required
                type="date"
                value={values.dueDate}
              />
            </label>
            <label className="text-xs font-black uppercase text-[#64748b]">
              Line item
              <input
                className={controlClass}
                onChange={(event) => update("firstItem", event.target.value)}
                required
                value={values.firstItem}
              />
            </label>
            <label className="text-xs font-black uppercase text-[#64748b]">
              Amount
              <input
                className={controlClass}
                min="0.01"
                onChange={(event) => update("amount", event.target.value)}
                required
                step="0.01"
                type="number"
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
              Cancel
            </button>
            <button
              className="h-10 rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white disabled:opacity-60"
              disabled={isSaving || !events.length}
              type="submit"
            >
              {isSaving ? "Creating…" : "Create invoice"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
