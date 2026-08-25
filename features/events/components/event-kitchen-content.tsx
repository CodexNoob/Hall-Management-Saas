"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AsyncState } from "@/components/ui/async-state";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardPermission } from "@/features/dashboard/hooks/use-dashboard-permission";
import { EventKitchenSkeleton } from "@/features/events/components/event-kitchen-skeleton";
import {
  Badge,
  LineIcon,
  type EventFile,
  type EventKitchenNotification,
  type EventKitchenResponse,
  type EventKitchenSheet
} from "@/features/events/components/event-manager-shared";
import {
  LineName,
  LineQuantity,
  LineStatus
} from "@/features/kitchen/components/kitchen-line-presentation";
import {
  formatOtherMeals,
  mealLabel
} from "@/features/kitchen/components/kitchen-shared";

/**
 * What this event's kitchen has to cook, and how far along it is.
 *
 * Read-only. Statuses and worker assignments are set on the kitchen board,
 * which owns the writes; this is the view from inside the event, where the
 * question is "what did we promise, and is it happening" rather than "what am I
 * cooking next".
 *
 * The rows are drawn by `kitchen-line-presentation`, which the board's dialog
 * also uses, so a dish reads identically in both places.
 */

function StatTile({
  label,
  note,
  value
}: {
  label: string;
  note: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[#d8dde5] bg-white p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
        {label}
      </p>
      <p className="mt-2 truncate text-base font-black text-[#17202a] sm:text-xl">
        {value}
      </p>
      <p className="mt-2 text-xs leading-4 text-[#6a7483]">{note}</p>
    </div>
  );
}

function KitchenSheet({
  event,
  sheet
}: {
  event: EventFile;
  sheet: EventKitchenSheet;
}) {
  const { counts, summary } = sheet;
  const dishes = sheet.lines.filter((line) => line.kind === "Dish");
  const addOns = sheet.lines.filter((line) => line.kind === "AddOn");
  const children = counts.boys + counts.girls + counts.kids;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 border-b border-[#d8dde5] bg-[#fbfcfd] p-3 sm:gap-3 sm:px-4 lg:grid-cols-4">
        <StatTile
          label="Portions"
          note={`${counts.couples} couples · ${children} children${
            counts.waiters > 0 ? ` · ${counts.waiters} waiters not counted` : ""
          }`}
          value={counts.totalGuests}
        />
        <StatTile label="Event starts" note={event.date} value={event.time} />
        <StatTile
          label="Prepared"
          note={`${summary.pending} pending · ${summary.notStarted} not started`}
          value={`${summary.complete}/${summary.dishes}`}
        />
        <StatTile
          label="Needs attention"
          note={
            summary.needsAttention === 0
              ? "Every dish has a quantity"
              : "Dishes with no quantity to cook to"
          }
          value={summary.needsAttention}
        />
      </div>

      {summary.needsAttention > 0 ? (
        <p
          className="border-b border-[#f0d9a8] bg-[#fdf8ec] px-3 py-2.5 text-xs leading-5 text-[#8a6414] sm:px-4"
          role="status"
        >
          {summary.needsAttention} dish
          {summary.needsAttention === 1 ? "" : "es"} cannot be counted yet.
          {summary.unresolvedBases.includes("Tables")
            ? " Draw the dining plan so per-table rules have a table count."
            : " Set a service style on the Menu tab, or a counting rule in the menu library."}
        </p>
      ) : null}

      {dishes.length === 0 ? (
        <p className="px-3 py-4 text-sm text-[#6a7483] sm:px-4">
          No dishes on this menu yet.
        </p>
      ) : (
        <>
          <div className="space-y-2 p-3 md:hidden">
            {dishes.map((line) => (
              <article
                className="rounded-lg border border-[#d8dde5] bg-white p-3"
                key={line.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <LineName line={line} />
                  <LineStatus status={line.status} />
                </div>
                <div className="mt-3 flex items-end justify-between gap-3 border-t border-[#d8dde5] pt-3">
                  <LineQuantity line={line} />
                  <span className="shrink-0 text-right text-xs text-[#6a7483]">
                    <span className="block">
                      {line.serviceStyle ?? "No style"}
                    </span>
                    <span className="block">
                      {line.assignedWorkerName ?? "Unassigned"}
                    </span>
                  </span>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-130 text-left text-sm">
              <thead className="bg-[#fbfcfd] text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
                <tr>
                  <th className="border-b border-[#d8dde5] px-4 py-3">Dish</th>
                  <th className="border-b border-[#d8dde5] px-3 py-3">
                    To cook
                  </th>
                  <th className="border-b border-[#d8dde5] px-3 py-3">Style</th>
                  <th className="border-b border-[#d8dde5] px-3 py-3">
                    Status
                  </th>
                  <th className="border-b border-[#d8dde5] px-4 py-3">
                    Assigned
                  </th>
                </tr>
              </thead>
              <tbody>
                {dishes.map((line) => (
                  <tr
                    className="border-b border-[#d8dde5] last:border-b-0"
                    key={line.id}
                  >
                    <td className="px-4 py-3">
                      <LineName line={line} />
                    </td>
                    <td className="px-3 py-3">
                      <LineQuantity line={line} />
                    </td>
                    <td className="px-3 py-3 text-xs text-[#6a7483]">
                      {line.serviceStyle ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <LineStatus status={line.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-[#6a7483]">
                      {line.assignedWorkerName ?? "Unassigned"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {addOns.length > 0 ? (
        <section className="border-t border-[#d8dde5] px-3 py-3 sm:px-4">
          <h3 className="text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
            Add-ons
          </h3>
          {/* Statusless on purpose: KitchenItemStatus is keyed by menu item, so
              an add-on line has nowhere to record one. */}
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {addOns.map((line) => (
              <li
                className="flex min-w-0 items-center gap-2.5 rounded-lg border border-[#d8dde5] bg-white px-3 py-2"
                key={line.id}
              >
                <LineName line={line} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function KitchenAcknowledgments({
  notifications
}: {
  notifications: EventKitchenNotification[];
}) {
  if (notifications.length === 0) {
    return (
      <section className="border-t border-[#d8dde5] bg-[#fbfcfd] px-3 py-3 sm:px-4">
        <h3 className="text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
          Kitchen acknowledgments
        </h3>
        <p className="mt-2 text-xs leading-5 text-[#6a7483]">
          No kitchen notifications have been sent for this event yet.
        </p>
      </section>
    );
  }

  return (
    <section className="border-t border-[#d8dde5] bg-[#fbfcfd] px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
          Kitchen acknowledgments
        </h3>
        <span className="text-xs font-bold text-[#6a7483]">
          {notifications.filter((item) => item.acknowledged).length}/
          {notifications.length} acknowledged
        </span>
      </div>

      <div className="mt-3 grid gap-2">
        {notifications.map((notification) => (
          <article
            className="rounded-lg border border-[#d8dde5] bg-white p-3"
            key={notification.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-black text-[#17202a]">
                  {notification.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#526173]">
                  {notification.description}
                </p>
              </div>
              <Badge tone={notification.acknowledged ? "green" : "gold"}>
                {notification.acknowledged ? "Acknowledged" : "Waiting"}
              </Badge>
            </div>

            <dl className="mt-3 grid gap-2 text-xs text-[#6a7483] sm:grid-cols-2">
              <div>
                <dt className="font-black uppercase tracking-[0.06em]">
                  Changed by
                </dt>
                <dd className="mt-0.5 font-semibold text-[#17202a]">
                  {notification.by}
                </dd>
              </div>
              <div>
                <dt className="font-black uppercase tracking-[0.06em]">
                  Sent
                </dt>
                <dd className="mt-0.5 font-semibold text-[#17202a]">
                  {notification.when}
                </dd>
              </div>
              <div>
                <dt className="font-black uppercase tracking-[0.06em]">
                  Old
                </dt>
                <dd className="mt-0.5 font-semibold text-[#17202a]">
                  {notification.oldValue}
                </dd>
              </div>
              <div>
                <dt className="font-black uppercase tracking-[0.06em]">
                  New
                </dt>
                <dd className="mt-0.5 font-semibold text-[#17202a]">
                  {notification.newValue}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-black uppercase tracking-[0.06em]">
                  Kitchen response
                </dt>
                <dd className="mt-0.5 font-semibold text-[#17202a]">
                  {notification.acknowledgedBy
                    ? `${notification.acknowledgedBy}${
                        notification.acknowledgedAt
                          ? ` — ${notification.acknowledgedAt}`
                          : ""
                      }`
                    : "Not acknowledged yet"}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}

export function EventKitchenContent({ event }: { event: EventFile }) {
  const router = useRouter();
  const kitchenQuery = useAuthenticatedQuery<EventKitchenResponse>(
    `/api/events/${event.id}/kitchen`
  );
  const canOpenKitchenBoard = useDashboardPermission("canViewKitchenDashboard");
  const sheet = kitchenQuery.data?.kitchen ?? null;
  const notifications = kitchenQuery.data?.notifications ?? [];
  // This tab asks for no meal, so the route answers `Main`. Until it offers a
  // picker, saying which meals it is not showing is the difference between an
  // incomplete sheet and one that looks finished.
  const otherMeals = sheet?.otherMeals ?? [];

  return (
    <section className="dashboard-panel-enter min-w-0 overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8dde5] px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <LineIcon name="fork" />
          <div className="min-w-0">
            <h2 className="text-[13px] font-black text-[#17202a] sm:text-sm">
              Kitchen sheet
            </h2>
            <p className="truncate text-xs text-[#6a7483]">
              {event.room} · {event.packageName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {sheet ? (
            // Whether these numbers can still move. The menu tab treats
            // ClientSubmitted as a draft; match it so the two never disagree.
            <Badge tone={sheet.menuStatus === "Confirmed" ? "green" : "gold"}>
              {sheet.menuStatus === "Confirmed"
                ? "Menu confirmed"
                : "Menu draft"}
            </Badge>
          ) : null}
          {canOpenKitchenBoard ? (
            <button
              className="h-8 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] transition hover:bg-[#eef4fa]"
              onClick={() => router.push("/dashboard/kitchen")}
              type="button"
            >
              Kitchen board
            </button>
          ) : null}
        </div>
      </header>

      {/* Above the sheet rather than inside it, because the case this exists
          for is an event whose only menu is a non-Main one - where the sheet
          itself renders as "no menu yet" and the notice is the only thing on
          screen telling the truth. */}
      {otherMeals.length > 0 ? (
        <p
          className="border-b border-[#f0d9a8] bg-[#fdf8ec] px-3 py-2.5 text-xs leading-5 text-[#8a6414] sm:px-4"
          role="status"
        >
          {formatOtherMeals(otherMeals)}{" "}
          {otherMeals.length === 1 ? "is" : "are"} not shown here. This sheet is
          the {mealLabel(sheet?.meal ?? "Main")} meal only.
        </p>
      ) : null}

      {kitchenQuery.isLoading ? (
        <EventKitchenSkeleton />
      ) : kitchenQuery.error ? (
        <div className="p-4">
          <AsyncState
            error={kitchenQuery.error}
            onRetry={() => void kitchenQuery.refetch()}
          />
        </div>
      ) : !sheet || sheet.lines.length === 0 ? (
        <div className="p-4">
          <AsyncState
            emptyMessage={
              otherMeals.length > 0
                ? "This event's dishes are on another meal, which this sheet cannot show yet."
                : "Add dishes on the Menu tab and this sheet fills in with what to cook."
            }
            emptyTitle={
              otherMeals.length > 0
                ? `Nothing on the ${mealLabel(sheet?.meal ?? "Main")} meal`
                : "No menu for this event yet"
            }
            isEmpty
          />
        </div>
      ) : (
        <KitchenSheet event={event} sheet={sheet} />
      )}

      {!kitchenQuery.isLoading && !kitchenQuery.error ? (
        <KitchenAcknowledgments notifications={notifications} />
      ) : null}

      <footer className="border-t border-[#d8dde5] bg-[#fbfcfd] px-3 py-2.5 text-xs text-[#6a7483] sm:px-4">
        Read-only. Statuses and worker assignments are set on the kitchen board.
      </footer>
    </section>
  );
}
