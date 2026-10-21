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
import { useAppLanguage } from "@/components/providers/app-language-provider";

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
  const { t } = useAppLanguage();
  const { counts, summary } = sheet;
  const dishes = sheet.lines.filter((line) => line.kind === "Dish");
  const addOns = sheet.lines.filter((line) => line.kind === "AddOn");
  const children = counts.boys + counts.girls + counts.kids;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 border-b border-[#d8dde5] bg-[#fbfcfd] p-3 sm:gap-3 sm:px-4 lg:grid-cols-4">
        <StatTile
          label={t("events.portions")}
          note={`${counts.couples} couples · ${children} children${
            counts.waiters > 0 ? ` · ${counts.waiters} waiters not counted` : ""
          }`}
          value={counts.totalGuests}
        />
        <StatTile label={t("events.eventStarts")} note={event.date} value={event.time} />
        <StatTile
          label={t("events.prepared")}
          note={t("events.pendingNotStarted", {
            pending: summary.pending,
            notStarted: summary.notStarted
          })}
          value={`${summary.complete}/${summary.dishes}`}
        />
        <StatTile
          label={t("events.needsAttention")}
          note={
            summary.needsAttention === 0
              ? t("events.everyDishHasQuantity")
              : t("events.dishesWithoutQuantity")
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
          {t("events.noDishes")}
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
                      {line.serviceStyle ?? t("events.noStyle")}
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
                  <th className="border-b border-[#d8dde5] px-4 py-3">{t("events.dish")}</th>
                  <th className="border-b border-[#d8dde5] px-3 py-3">
                    {t("events.toCook")}
                  </th>
                  <th className="border-b border-[#d8dde5] px-3 py-3">{t("events.style")}</th>
                  <th className="border-b border-[#d8dde5] px-3 py-3">
                    {t("common.status")}
                  </th>
                  <th className="border-b border-[#d8dde5] px-4 py-3">
                    {t("events.assigned")}
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
            {t("events.addOns")}
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
  hasMore = false,
  notifications
}: {
  /** Whether older notifications exist beyond the ones handed in. */
  hasMore?: boolean;
  notifications: EventKitchenNotification[];
}) {
  const { t } = useAppLanguage();
  const acknowledgedNotifications = notifications.filter(
    (item) => item.acknowledged
  );
  /*
   * The feed arrives newest first, so the first acknowledged row in it is the
   * most recent one - this used to reverse the list before looking, and so
   * reported the OLDEST acknowledgment under a line that says "Last by".
   *
   * Ordered by when the change was raised rather than by when it was signed
   * off, because `acknowledgedAt` reaches the browser already formatted for
   * display and cannot be sorted on. In practice they agree: a change is
   * acknowledged after it is raised, and the kitchen works through them in the
   * order they arrive.
   */
  const latestAcknowledgment = acknowledgedNotifications.find(
    (item) => item.acknowledgedBy
  );

  if (notifications.length === 0) {
    return (
      <section className="border-t border-[#d8dde5] bg-[#fbfcfd] px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.08em] text-[#1f4d73]">
              {t("events.kitchenAcks")}
            </h3>
            <p className="mt-1 text-xs leading-5 text-[#526173]">
              {t("events.noKitchenNotification")}
            </p>
          </div>
          <Badge tone="gold">{t("events.noNotifications")}</Badge>
        </div>
      </section>
    );
  }

  return (
    <section className="border-t border-[#d8dde5] bg-[#fbfcfd] px-3 py-3 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-black uppercase tracking-[0.08em] text-[#1f4d73]">
            {t("events.kitchenAcks")}
          </h3>
          {/*
            "Showing the most recent" when the list is cut, rather than
            "N sent" - the second is not a smaller number than the truth, it is
            a different one, and this line is read to judge whether the kitchen
            is on top of an event's changes.
          */}
          <p className="mt-1 text-xs leading-5 text-[#526173]">
            {hasMore
              ? t("events.showingMostRecent", { count: notifications.length })
              : `${notifications.length} notification${
                  notifications.length === 1 ? "" : "s"
                } sent`}{" "}
            · {acknowledgedNotifications.length} acknowledged
            {latestAcknowledgment?.acknowledgedBy
              ? ` · Last by ${latestAcknowledgment.acknowledgedBy}${
                  latestAcknowledgment.acknowledgedAt
                    ? ` at ${latestAcknowledgment.acknowledgedAt}`
                    : ""
                }`
              : ""}
          </p>
          {hasMore ? (
            <p className="mt-1 text-xs leading-5 text-[#6a7483]">
              {t("events.olderNotificationsHidden")}
            </p>
          ) : null}
        </div>
        <Badge
          tone={
            acknowledgedNotifications.length === notifications.length
              ? "green"
              : "gold"
          }
        >
          {acknowledgedNotifications.length}/{notifications.length} acknowledged
        </Badge>
      </div>

      <div className="mt-3 divide-y divide-[#d8dde5] border border-[#d8dde5] bg-white">
        {notifications.map((notification) => (
          <article
            className="p-3"
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
                  {t("events.changedBy")}
                </dt>
                <dd className="mt-0.5 font-semibold text-[#17202a]">
                  {notification.by}
                </dd>
              </div>
              <div>
                <dt className="font-black uppercase tracking-[0.06em]">
                  {t("events.sent")}
                </dt>
                <dd className="mt-0.5 font-semibold text-[#17202a]">
                  {notification.when}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-black uppercase tracking-[0.06em]">
                  {t("events.kitchenResponse")}
                </dt>
                <dd className="mt-0.5 font-semibold text-[#17202a]">
                  {notification.acknowledgedBy
                    ? `${notification.acknowledgedBy}${
                        notification.acknowledgedAt
                          ? ` — ${notification.acknowledgedAt}`
                          : ""
                      }`
                    : t("events.notAcknowledgedYet")}
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
  const { t } = useAppLanguage();
  const router = useRouter();
  const kitchenQuery = useAuthenticatedQuery<EventKitchenResponse>(
    `/api/events/${event.id}/kitchen`
  );
  const canOpenKitchenBoard = useDashboardPermission("kitchen.read");
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
              {t("events.kitchenSheet")}
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
                ? t("events.menuConfirmed")
                : t("events.menuDraft")}
            </Badge>
          ) : null}
          {canOpenKitchenBoard ? (
            <button
              className="h-8 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] transition hover:bg-[#eef4fa]"
              onClick={() => router.push("/dashboard/kitchen")}
              type="button"
            >
              {t("events.kitchenBoard")}
            </button>
          ) : null}
        </div>
      </header>

      {/* Above the sheet rather than inside it, because the case this exists
          for is an event whose only menu is a non-Main one - where the sheet
          itself renders as t("events.noMenuYet") and the notice is the only thing on
          screen telling the truth. */}
      {otherMeals.length > 0 ? (
        <p
          className="border-b border-[#f0d9a8] bg-[#fdf8ec] px-3 py-2.5 text-xs leading-5 text-[#8a6414] sm:px-4"
          role="status"
        >
          {formatOtherMeals(otherMeals, t)}{" "}
          {otherMeals.length === 1 ? "is" : "are"} not shown here. This sheet is
          the {mealLabel(sheet?.meal ?? "Main", t)} meal only.
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
                : t("events.addDishesHint")
            }
            emptyTitle={
              otherMeals.length > 0
                ? t("events.nothingOnMeal", {
                    meal: mealLabel(sheet?.meal ?? "Main", t)
                  })
                : t("events.noMenuForEvent")
            }
            isEmpty
          />
        </div>
      ) : (
        <KitchenSheet event={event} sheet={sheet} />
      )}

      {!kitchenQuery.isLoading && !kitchenQuery.error ? (
        <KitchenAcknowledgments
          hasMore={kitchenQuery.data?.notificationsHasMore ?? false}
          notifications={notifications}
        />
      ) : null}

      <footer className="border-t border-[#d8dde5] bg-[#fbfcfd] px-3 py-2.5 text-xs text-[#6a7483] sm:px-4">
        {t("events.kitchenReadOnly")}
      </footer>
    </section>
  );
}
