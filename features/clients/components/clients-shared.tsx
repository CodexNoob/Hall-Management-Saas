"use client";

export type ClientStatus = "Active" | "Inactive" | "Lead";
export type ClientRecord = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: ClientStatus;
  tags: string[];
  notes: string | null;
  totalBilledCents: number;
  totalPaidCents: number;
  outstandingCents: number;
  fileCount: number;
  events: Array<{
    id: string;
    eventDate: string;
    eventType: string | null;
    eventStatus: string;
    hallName: string | null;
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    status: string;
    totalCents: number;
    amountPaidCents: number;
    dueDate: string | null;
  }>;
  activityLogs: Array<{
    id: string;
    actionType: string;
    message: string;
    createdAt: string;
  }>;
};

export type ClientsResponse = { clients: ClientRecord[] };

export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100
  );

export const date = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(value));

export function StatusBadge({ status }: { status: ClientStatus }) {
  const tone =
    status === "Active"
      ? "border-[#9edbc1] bg-[#edfbf4] text-[#067647]"
      : status === "Lead"
        ? "border-[#efd49b] bg-[#fff8e8] text-[#9a5b00]"
        : "border-[#cbd3dc] bg-[#f4f6f8] text-[#536172]";
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${tone}`}
    >
      {status}
    </span>
  );
}

export function Metric({
  label,
  value,
  note
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="rounded-xl border border-[#d8dde5] bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#687588]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs text-[#6a7483]">{note}</p>
    </article>
  );
}
