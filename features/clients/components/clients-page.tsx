"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardTopbar } from "@/components/layout/dashboard-topbar";
import { AsyncState } from "@/components/ui/async-state";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPageSearch } from "@/features/dashboard/hooks/use-dashboard-page-search";
import { useDashboardPermission } from "@/features/dashboard/hooks/use-dashboard-permission";

import { NewClientDialog } from "@/features/clients/components/new-client-dialog";
import { showBillingReadouts, showFileReadouts } from "@/lib/ui/mvp-features";
import {
  Metric,
  StatusBadge,
  date,
  money,
  type ClientRecord,
  type ClientStatus,
  type ClientsResponse
} from "@/features/clients/components/clients-shared";
export function ClientsPage() {
  const router = useRouter();
  const canEdit = useDashboardPermission("canEditClients");
  const query = useAuthenticatedQuery<ClientsResponse>("/api/clients");
  const updateMutation = useAuthenticatedMutation<
    { id: string; status: ClientStatus },
    { client: ClientRecord }
  >("/api/clients", "PATCH");
  const [search, setSearch] = useDashboardPageSearch("Clients");
  const [status, setStatus] = useState<"All" | ClientStatus>("All");
  const [selectedId, setSelectedId] = useState("");
  const [isNewClientOpen, setIsNewClientOpen] = useState(false);
  const clients = useMemo(() => query.data?.clients ?? [], [query.data]);
  const filtered = useMemo(
    () =>
      clients.filter((client) => {
        const value =
          `${client.name} ${client.email ?? ""} ${client.phone ?? ""} ${client.tags.join(" ")}`.toLowerCase();
        return (
          (!search.trim() || value.includes(search.trim().toLowerCase())) &&
          (status === "All" || client.status === status)
        );
      }),
    [clients, search, status]
  );
  const selected =
    clients.find((client) => client.id === selectedId) ??
    filtered[0] ??
    clients[0];
  const upcomingEvents = clients
    .flatMap((client) => client.events)
    .filter((event) => new Date(event.eventDate) >= new Date()).length;
  const outstanding = clients.reduce(
    (sum, client) => sum + client.outstandingCents,
    0
  );

  const changeStatus = async (nextStatus: ClientStatus) => {
    if (!selected) return;
    await updateMutation.mutate({ id: selected.id, status: nextStatus });
    await query.refetch();
  };

  return (
    <div className="dashboard-readable-page flex h-dvh min-h-0 flex-col overflow-hidden bg-[#f5f6f8] text-[#17202a]">
      <DashboardTopbar
        title="Clients"
        subtitle="Manage client contacts, event history, and internal notes."
        actionsSlot={
          <button
            className="h-10 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white"
            disabled={!canEdit}
            onClick={() => setIsNewClientOpen(true)}
            title={canEdit ? "Create client" : "You have read-only access"}
            type="button"
          >
            + New client
          </button>
        }
      />
      <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {query.isLoading || query.error ? (
          <div className="flex h-full min-h-80 items-center justify-center">
            <AsyncState
              error={query.error}
              isLoading={query.isLoading}
              onRetry={query.refetch}
            />
          </div>
        ) : (
          <div className="mx-auto max-w-450 space-y-4">
            <section
              className={`grid gap-3 sm:grid-cols-2 ${
                showBillingReadouts ? "xl:grid-cols-4" : "xl:grid-cols-3"
              }`}
            >
              <Metric
                label="Total clients"
                value={String(clients.length)}
                note="Organization client records"
              />
              <Metric
                label="Active clients"
                value={String(
                  clients.filter((client) => client.status === "Active").length
                )}
                note="Currently active"
              />
              <Metric
                label="Upcoming events"
                value={String(upcomingEvents)}
                note="Scheduled client events"
              />
              {showBillingReadouts ? (
                <Metric
                  label="Outstanding"
                  value={money(outstanding)}
                  note="Across open invoices"
                />
              ) : null}
            </section>
            {clients.length === 0 ? (
              <AsyncState
                isEmpty
                emptyTitle="No clients yet"
                emptyMessage="Create the first client or create an event to populate the directory."
              />
            ) : (
              <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.8fr)_minmax(0,1.2fr)]">
                <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
                  <header className="border-b border-[#d8dde5] p-4">
                    <h2 className="font-black">Client directory</h2>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_130px]">
                      <input
                        className="h-10 rounded-lg border border-[#b9c2cf] px-3 text-sm"
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search name, email, phone or tag"
                        type="search"
                        value={search}
                      />
                      <select
                        className="h-10 rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm"
                        onChange={(event) =>
                          setStatus(event.target.value as typeof status)
                        }
                        value={status}
                      >
                        <option>All</option>
                        <option>Active</option>
                        <option>Lead</option>
                        <option>Inactive</option>
                      </select>
                    </div>
                  </header>
                  <div className="max-h-[calc(100dvh-330px)] space-y-2 overflow-y-auto p-3">
                    {filtered.map((client) => (
                      <button
                        className={`w-full rounded-lg border p-3 text-left transition ${selected?.id === client.id ? "border-[#1f4d73] bg-[#eef4fa]" : "border-[#d8dde5] hover:bg-[#f8fafc]"}`}
                        key={client.id}
                        onClick={() => setSelectedId(client.id)}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <strong className="block truncate text-sm">
                              {client.name}
                            </strong>
                            <span className="mt-1 block truncate text-xs text-[#6a7483]">
                              {client.email ??
                                client.phone ??
                                "No contact details"}
                            </span>
                          </div>
                          <StatusBadge status={client.status} />
                        </div>
                        <div className="mt-3 flex justify-between text-[10px] font-bold text-[#6a7483]">
                          <span>{client.events.length} events</span>
                          {showBillingReadouts ? (
                            <span>
                              {money(client.outstandingCents)} outstanding
                            </span>
                          ) : null}
                        </div>
                      </button>
                    ))}
                    {filtered.length === 0 ? (
                      <AsyncState
                        isEmpty
                        emptyTitle="No matching clients"
                        emptyMessage="Adjust your search or status filter."
                      />
                    ) : null}
                  </div>
                </section>
                {selected ? (
                  <section className="min-w-0 space-y-4">
                    <article className="rounded-xl border border-[#d8dde5] bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h1 className="text-xl font-black">
                              {selected.name}
                            </h1>
                            <StatusBadge status={selected.status} />
                          </div>
                          <p className="mt-2 text-sm text-[#6a7483]">
                            {selected.email ?? "No email"} ·{" "}
                            {selected.phone ?? "No phone"}
                          </p>
                          {selected.tags.length ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {selected.tags.map((tag) => (
                                <span
                                  className="rounded-full bg-[#eef4fa] px-2 py-1 text-[10px] font-black"
                                  key={tag}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            className="h-9 rounded-lg border border-[#b9c2cf] px-3 text-xs font-black"
                            disabled={!canEdit}
                            onClick={() =>
                              changeStatus(
                                selected.status === "Inactive"
                                  ? "Active"
                                  : "Inactive"
                              )
                            }
                            type="button"
                          >
                            {selected.status === "Inactive"
                              ? "Activate"
                              : "Mark inactive"}
                          </button>
                          <button
                            className="h-9 rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white"
                            onClick={() =>
                              router.push(
                                `/dashboard/events?clientId=${selected.id}`
                              )
                            }
                            type="button"
                          >
                            Open events
                          </button>
                        </div>
                      </div>
                      {/* Every tile here is answered by a hidden module, so for
                          the MVP the row collapses rather than leaving four
                          numbers with nowhere to act on them. */}
                      {showBillingReadouts || showFileReadouts ? (
                        <div className="mt-4 grid gap-2 sm:grid-cols-4">
                          {showBillingReadouts ? (
                            <>
                              <Metric
                                label="Billed"
                                value={money(selected.totalBilledCents)}
                                note="All invoices"
                              />
                              <Metric
                                label="Paid"
                                value={money(selected.totalPaidCents)}
                                note="Paid transactions"
                              />
                              <Metric
                                label="Outstanding"
                                value={money(selected.outstandingCents)}
                                note="Open balances"
                              />
                            </>
                          ) : null}
                          {showFileReadouts ? (
                            <Metric
                              label="Files"
                              value={String(selected.fileCount)}
                              note="Linked documents"
                            />
                          ) : null}
                        </div>
                      ) : null}
                      {selected.notes ? (
                        <div className="mt-4 rounded-lg bg-[#f8fafc] p-3 text-sm">
                          <strong>Internal notes</strong>
                          <p className="mt-1 text-[#536172]">
                            {selected.notes}
                          </p>
                        </div>
                      ) : null}
                    </article>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <article className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
                        <header className="border-b border-[#d8dde5] p-4">
                          <h2 className="font-black">Events</h2>
                        </header>
                        <div className="space-y-2 p-3">
                          {selected.events.map((event) => (
                            <button
                              className="w-full rounded-lg border border-[#d8dde5] p-3 text-left hover:bg-[#f8fafc]"
                              key={event.id}
                              onClick={() => router.push("/dashboard/events")}
                              type="button"
                            >
                              <div className="flex justify-between gap-3">
                                <strong>{event.eventType ?? "Event"}</strong>
                                <span className="text-xs font-bold">
                                  {date(event.eventDate)}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[#6a7483]">
                                {event.hallName ?? "Hall not assigned"} ·{" "}
                                {event.eventStatus}
                              </p>
                            </button>
                          ))}
                          {selected.events.length === 0 ? (
                            <AsyncState
                              isEmpty
                              emptyTitle="No events"
                              emptyMessage="Create an event for this client."
                            />
                          ) : null}
                        </div>
                      </article>
                      <article className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white">
                        <header className="border-b border-[#d8dde5] p-4">
                          <h2 className="font-black">Recent activity</h2>
                        </header>
                        <div className="space-y-3 p-4">
                          {selected.activityLogs.map((activity) => (
                            <div
                              className="border-l-2 border-[#bfd2e2] pl-3"
                              key={activity.id}
                            >
                              <strong className="text-xs">
                                {activity.actionType}
                              </strong>
                              <p className="mt-1 text-xs text-[#536172]">
                                {activity.message}
                              </p>
                              <span className="mt-1 block text-[10px] text-[#8290a2]">
                                {date(activity.createdAt)}
                              </span>
                            </div>
                          ))}
                          {selected.activityLogs.length === 0 ? (
                            <AsyncState
                              isEmpty
                              emptyTitle="No activity yet"
                              emptyMessage="Client changes and linked actions will appear here."
                            />
                          ) : null}
                        </div>
                      </article>
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </div>
        )}
      </main>
      <NewClientDialog
        open={canEdit && isNewClientOpen}
        onClose={() => setIsNewClientOpen(false)}
        onCreated={async () => {
          await query.refetch();
        }}
      />
    </div>
  );
}
