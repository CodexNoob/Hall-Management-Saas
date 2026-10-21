"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { KitchenResponse } from "@/features/kitchen/components/kitchen-shared";
import type { MessageKey } from "@/lib/i18n/messages";
import { useAppLanguage } from "@/components/providers/app-language-provider";

type KitchenNotification = KitchenResponse["notifications"][number];

type NotificationFilter = "all" | "unacknowledged" | "acknowledged";

const NOTIFICATION_FILTERS: Array<{
  id: NotificationFilter;
  labelKey: MessageKey;
}> = [
  { id: "all", labelKey: "kitchen.filterAll" },
  { id: "unacknowledged", labelKey: "kitchen.filterNeedsAction" },
  { id: "acknowledged", labelKey: "kitchen.filterAcknowledged" }
];

function matchesFilter(
  notification: KitchenNotification,
  filter: NotificationFilter
) {
  if (filter === "acknowledged") return notification.acknowledged;
  if (filter === "unacknowledged") return !notification.acknowledged;

  return true;
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      className="mr-2 inline h-5 w-5 align-[-3px]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      aria-hidden="true"
      className="mr-1 inline h-3.5 w-3.5 align-[-2px]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9v5M12 17.5h.01" />
    </svg>
  );
}

type KitchenNotificationsDrawerProps = {
  acknowledgmentError?: string | null;
  /**
   * Whether this caller is shown the whole kitchen, or only their own work.
   *
   * One fact, and it decides two things, because they are the same difference.
   *
   * A supervisor reads a ledger: every notification in the organization, an
   * audit trail behind each one, and the two controls that sweep the feed.
   *
   * A cook is sent only the notifications for events they are cooking on, and
   * the API refuses their acknowledge-all and clear with a 403 - so those
   * controls are withheld rather than disabled, since a disabled control
   * describes work the person could do in some other state and there is no such
   * state here. What is left is shaped for the one question they open this to
   * ask: has anything changed about my work. The event, hall and date sit on
   * the face of the card rather than behind a toggle, the dish list with them,
   * and the delivery receipt for the manager's own email is not their business.
   */
  seesWholeKitchen?: boolean;
  open: boolean;
  onClose: () => void;
  notifications: KitchenNotification[];
  onAcknowledge: (notificationId: string) => void | Promise<void>;
  onAcknowledgeAll: () => void | Promise<void>;
  onClearNotifications: () => void | Promise<void>;
  acknowledgingId?: string | null;
  bulkAction?: "acknowledge-all" | "clear" | null;
  /** Whether older notifications exist beyond the ones in `notifications`. */
  hasMoreNotifications?: boolean;
};

export function KitchenNotificationsDrawer({
  acknowledgmentError = null,
  acknowledgingId = null,
  bulkAction = null,
  hasMoreNotifications = false,
  notifications,
  open,
  seesWholeKitchen = false,
  onAcknowledge,
  onAcknowledgeAll,
  onClearNotifications,
  onClose
}: KitchenNotificationsDrawerProps) {
  const { t } = useAppLanguage();
  const hasUnacknowledged = notifications.some((item) => !item.acknowledged);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const countFor = (id: NotificationFilter) =>
    notifications.filter((item) => matchesFilter(item, id)).length;
  const visibleNotifications = notifications.filter((item) =>
    matchesFilter(item, filter)
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-100 bg-[#061126]/55">
      <aside
        aria-label={t("kitchen.notificationsTitle")}
        aria-modal="true"
        className="fixed bottom-0 right-0 top-0 z-101 flex w-full max-w-130 flex-col bg-white shadow-2xl shadow-black/30"
        role="dialog"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 bg-[#061126] px-5 py-4 text-white">
          <div>
            <h2 className="text-xl font-black leading-tight">
              <BellIcon />
              {t("kitchen.notificationsTitle")}
            </h2>
            <p className="mt-1 text-sm font-semibold text-[#cbd5e1]">
              {seesWholeKitchen
                ? t("kitchen.changeHistory")
                : t("kitchen.yourEventChanges")}
            </p>
          </div>
          <button
            aria-label={t("kitchen.closeNotifications")}
            // Hover inverts rather than tinting. A translucent white wash over
            // the navy header lightened the square to roughly the colour of the
            // glyph on it, so the × faded out exactly when the pointer was on
            // it. Setting both ends of the pair keeps the contrast whichever
            // way round it is drawn.
            className="flex h-11 w-11 items-center justify-center border border-[#44536a] text-3xl leading-none text-white transition hover:border-white hover:bg-white hover:text-[#061126]"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        {seesWholeKitchen ? (
          <div className="flex shrink-0 flex-wrap gap-2 border-b border-[#e2e8f0] px-5 py-3">
            <button
              className="h-9 border border-[#061126] bg-[#061126] px-3 text-xs font-black text-white hover:bg-[#16243a] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!hasUnacknowledged || bulkAction !== null}
              onClick={() => void onAcknowledgeAll()}
              type="button"
            >
              {bulkAction === "acknowledge-all"
                ? t("kitchen.acknowledging")
                : t("kitchen.acknowledgeAll")}
            </button>
            <button
              className="h-9 border border-[#efb5ad] bg-white px-3 text-xs font-black text-[#b42318] hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={notifications.length === 0 || bulkAction !== null}
              onClick={() => setIsConfirmingClear(true)}
              type="button"
            >
              {bulkAction === "clear" ? t("kitchen.clearing") : t("kitchen.clearNotifications")}
            </button>
          </div>
        ) : null}

        {/*
          A filter for everyone, cooks included. "What has the kitchen already
          signed off" is a question somebody asks on purpose - about their own
          work, or about the shift's - and answering it by scrolling one
          chronological list looking for green chips is not an answer.
        */}
        <div
          aria-label={t("kitchen.notificationFilter")}
          className="flex shrink-0 gap-2 border-b border-[#e2e8f0] px-5 py-3"
          role="group"
        >
          {NOTIFICATION_FILTERS.map(({ id, labelKey }) => {
            const isActive = filter === id;

            return (
              <button
                aria-pressed={isActive}
                className={`h-9 border px-3 text-xs font-black transition ${
                  isActive
                    ? "border-[#061126] bg-[#061126] text-white"
                    : "border-[#cbd5e1] bg-white text-[#334155] hover:bg-[#f1f5f9]"
                }`}
                key={id}
                onClick={() => setFilter(id)}
                type="button"
              >
                {t(labelKey)} ({countFor(id)})
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {acknowledgmentError ? (
            <p
              className="mb-3 border border-[#f0b9b4] bg-[#fff5f4] px-3 py-2 text-sm font-bold text-[#b42318]"
              role="alert"
            >
              {acknowledgmentError}
            </p>
          ) : null}

          {visibleNotifications.length ? (
            <div className="grid gap-3">
              {visibleNotifications.map((notification) => (
                <NotificationCard
                  acknowledging={acknowledgingId === notification.id}
                  key={notification.id}
                  notification={notification}
                  onAcknowledge={onAcknowledge}
                  seesWholeKitchen={seesWholeKitchen}
                />
              ))}
            </div>
          ) : filter !== "all" ? (
            /* An empty filter is not an empty feed, and saying "no kitchen
               notifications" while a hundred sit one tab away would be a lie
               about the state of the kitchen. */
            <div className="border border-[#d8dde5] bg-[#f8fafc] px-4 py-8 text-center text-sm font-bold text-[#64748b]">
              {filter === "acknowledged"
                ? t("kitchen.nothingAcknowledged")
                : t("kitchen.nothingWaiting")}
              <span className="mt-1 block font-semibold text-[#94a3b8]">
                {notifications.length} notification
                {notifications.length === 1 ? "" : "s"} in all - choose All to
                see them.
              </span>
            </div>
          ) : (
            /* Two different facts. "None" is true for a supervisor, who is sent
               the organization's whole feed - but for a cook, who is sent only
               the events they are cooking on, there may be twenty and none of
               them theirs. The board already words an empty day this way for the
               same reason. */
            <div className="border border-[#d8dde5] bg-[#f8fafc] px-4 py-8 text-center text-sm font-bold text-[#64748b]">
              {seesWholeKitchen ? (
                t("kitchen.noNotifications")
              ) : (
                <>
                  {t("kitchen.nothingNeedsYou")}
                  <span className="mt-1 block font-semibold text-[#94a3b8]">
                    {t("kitchen.changesWillAppear")}
                  </span>
                </>
              )}
            </div>
          )}

          {/*
            The feed is capped, and a cap nobody is told about reads as "that is
            everything" - which is exactly the wrong thing to believe about a
            list of changes somebody is checking they have not missed.
          */}
          {hasMoreNotifications ? (
            <p className="mt-3 border border-[#e2e8f0] bg-[#f8fafc] px-3 py-2 text-center text-xs font-bold text-[#64748b]">
              Showing the {notifications.length} most recent. Older
              notifications are not listed here.
            </p>
          ) : null}
        </div>
      </aside>

      {/*
        A styled confirmation rather than the browser's, which every other
        destructive action here already uses: this deletes the organization's
        whole feed, including the audit trail behind each acknowledgment, and a
        one-line native prompt is a thin thing to stand in front of that.
      */}
      <ConfirmDialog
        // Not t("kitchen.clearNotifications"), which is the toolbar button behind it:
        // two controls a click apart reading the same is how somebody confirms
        // something they thought they were opening.
        confirmLabel={t("kitchen.clearAllNotifications")}
        description={t("kitchen.clearAllConfirm", {
          count: notifications.length
        })}
        fallbackErrorMessage={t("kitchen.clearFailed")}
        onClose={() => setIsConfirmingClear(false)}
        onConfirm={async () => {
          await onClearNotifications();
          setIsConfirmingClear(false);
        }}
        open={isConfirmingClear}
        pendingLabel={t("kitchen.clearingEllipsis")}
        title={t("kitchen.clearEveryNotification")}
      />
    </div>
  );
}

function NotificationCard({
  acknowledging,
  onAcknowledge,
  notification,
  seesWholeKitchen
}: {
  acknowledging: boolean;
  onAcknowledge: (notificationId: string) => void | Promise<void>;
  notification: KitchenNotification;
  seesWholeKitchen: boolean;
}) {
  const { t } = useAppLanguage();
  const [showChanges, setShowChanges] = useState(false);
  // Which day, which hall, whose event - the first thing a cook needs and the
  // last thing they should have to open a panel for. A supervisor reading the
  // whole organization's feed keeps it in the audit list below, where it sits
  // beside the rest of the trail.
  const whichEvent = [notification.event, notification.hall, notification.date]
    .filter((part) => part && part !== "—")
    .join(" · ");
  const changedItem =
    notification.title === t("kitchen.menuChanged")
      ? t("kitchen.menuStatus")
      : notification.title === t("kitchen.suddenEvent")
        ? t("kitchen.eventSchedule")
        : notification.title;

  return (
    <article
      className={`border p-4 text-sm text-[#111827] ${
        notification.acknowledged
          ? "border-[#b7e4c7] bg-[#f7fff9]"
          : "border-[#ff8a8a] bg-[#fff7f7] shadow-sm shadow-[#dc2626]/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-black">{notification.title}</h3>
        <span
          className={`border px-2 py-1 text-xs font-black ${
            notification.acknowledged
              ? "border-[#86efac] bg-[#f0fdf4] text-[#166534]"
              : "border-[#ff9b9b] bg-[#ffecec] text-[#dc2626]"
          }`}
        >
          {notification.acknowledged ? (
            "Acknowledged"
          ) : (
            <>
              <AlertIcon /> {t("kitchen.unacknowledged")}
            </>
          )}
        </span>
      </div>
      {!seesWholeKitchen && whichEvent ? (
        <p className="mt-1 text-xs font-bold text-[#475467]">{whichEvent}</p>
      ) : null}

      <p className="mt-4 font-black leading-6">{notification.description}</p>

      {/* A cook is reading their own event, so the dish list is the point of the
          card and opens with it. The raw before/after pair is deliberately not
          the fallback here: where no clean summary was parsed, the message above
          has already said what happened, and two columns of dumped JSON say it
          worse. */}
      {!seesWholeKitchen && notification.changeSummary ? (
        <div className="mt-3">
          <CleanChangeSummary notification={notification} />
        </div>
      ) : null}

      {!seesWholeKitchen ? (
        <p className="mt-3 text-xs font-semibold text-[#64748b]">
          Changed by{" "}
          <span className="font-black text-[#17202a]">{notification.by}</span>
        </p>
      ) : null}

      {showChanges ? (
        <section className="mt-3 border border-[#d8dde5] bg-white p-3">
          <h4 className="text-xs font-black uppercase tracking-[0.06em] text-[#1f4d73]">
            {t("kitchen.changeByEventManager")}
          </h4>

          {/* The cook's version holds only what the face of their card does not
              already carry - not a second copy of the event, the dish list and
              the name, which is what this panel would be for them otherwise. */}
          <dl className="mt-3 grid gap-3">
            {seesWholeKitchen ? (
              <>
                <Meta label={t("common.event")} value={notification.event} />
                <Meta label={t("kitchen.hall")} value={notification.hall} />
                <Meta label={t("common.date")} value={notification.date} />
              </>
            ) : null}
            <Meta label={t("kitchen.changedItem")} value={changedItem} />
            {seesWholeKitchen ? (
              <>
                <CleanChangeSummary notification={notification} />
                <Meta label={t("kitchen.changedBy")} value={notification.by} />
              </>
            ) : null}
            <Meta label={t("kitchen.changedAt")} value={notification.when} />
          </dl>
        </section>
      ) : null}

      <div
        className={`mt-4 border p-3 ${
          notification.acknowledged
            ? "border-[#bbf7d0] bg-[#f0fdf4]"
            : "border-[#fed7aa] bg-[#fff7ed]"
        }`}
      >
        <p className="text-xs font-black uppercase tracking-wider text-[#64748b]">
          {t("kitchen.response")}
        </p>
        <p className="mt-1 text-sm font-black text-[#17202a]">
          {notification.acknowledgedBy
            ? `${notification.acknowledgedBy}${
                notification.acknowledgedAt
                  ? ` — ${notification.acknowledgedAt}`
                  : ""
              }`
            : t("kitchen.waitingForAck")}
        </p>
      </div>

      {/* The receipt for the notification email the platform sent - a fact about
          the supervisor's own inbox, and nothing a cook can act on. */}
      {seesWholeKitchen && notification.emailSent ? (
        <p className="mt-3 text-xs font-semibold text-[#0284c7]">
          Email: {notification.emailSent}
        </p>
      ) : null}

      {notification.acknowledgedBy || notification.emailSent ? (
        <div className="sr-only">
          {notification.acknowledgedBy ? (
            <>
              <p className="text-xs font-black uppercase tracking-wider text-[#64748b]">
                {t("kitchen.acknowledgedBy")}
              </p>
              <p className="mt-1 text-xs font-bold">
                {notification.acknowledgedBy}
                {notification.acknowledgedAt ? (
                  <span className="font-semibold text-[#94a3b8]">
                    {" "}
                    — {notification.acknowledgedAt}
                  </span>
                ) : null}
              </p>
            </>
          ) : null}

          {/* Read aloud rather than seen, so it spells the word out where the
              visible copy above uses its t("kitchen.emailLabel") label - the glyph that used
              to stand in for it here was announced as its character name. Held
              back from a cook for the same reason the visible one is: withheld
              on screen but still announced would be no restriction at all. */}
          {seesWholeKitchen && notification.emailSent ? (
            <p className="mt-3 text-xs font-semibold text-[#0284c7]">
              Email: {notification.emailSent}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="h-10 border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]"
          onClick={() => setShowChanges((current) => !current)}
          type="button"
        >
          {showChanges ? t("kitchen.hideChanges") : t("kitchen.viewChanges")}
        </button>

        {!notification.acknowledged ? (
          <button
            className="h-10 flex-1 border border-[#061126] bg-[#061126] px-4 text-xs font-black text-white hover:bg-[#16243a] disabled:cursor-wait disabled:opacity-60 sm:flex-none"
            disabled={acknowledging}
            onClick={() => void onAcknowledge(notification.id)}
            type="button"
          >
            {acknowledging ? t("kitchen.savingAcknowledgment") : t("kitchen.acknowledgeNow")}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[92px_1fr] gap-3">
      <dt className="text-xs font-black uppercase tracking-[0.06em] text-[#64748b]">
        {label}
      </dt>
      <dd className="text-xs font-semibold text-[#111827]">{value}</dd>
    </div>
  );
}

function ChangeValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[#d8dde5] bg-[#fbfcfd] p-3">
      <dt className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </dt>
      <dd className="mt-2 whitespace-pre-wrap text-sm font-black leading-5 text-[#111827]">
        {value}
      </dd>
    </div>
  );
}

function CleanChangeSummary({
  notification
}: {
  notification: KitchenNotification;
}) {
  const { t } = useAppLanguage();

  if (!notification.changeSummary) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <ChangeValue label={t("kitchen.before")} value={notification.oldValue} />
        <ChangeValue label={t("kitchen.after")} value={notification.newValue} />
      </div>
    );
  }

  const { afterStatus, beforeStatus, items, meal, otherItemCount } =
    notification.changeSummary;
  // Present only on a cook's copy, where the list was narrowed to their own
  // dishes. Nought is not the same as absent: a cook whose every dish is still
  // on the menu gets a nought here and no remainder line, while a supervisor
  // gets no field at all because their list was never narrowed.
  const otherDishes = otherItemCount ?? 0;

  return (
    <div className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <MiniChangeStat label={t("kitchen.before")} value={beforeStatus ?? "—"} />
        <MiniChangeStat label={t("kitchen.after")} value={afterStatus ?? "—"} />
        <MiniChangeStat label={t("kitchen.meal")} value={meal ?? "—"} />
      </div>

      {items.length === 0 && otherDishes > 0 ? (
        // The list was narrowed and nothing survived it. Said out loud, because
        // an empty panel here would read as "the menu is empty" when what
        // happened is that this change is somebody else's work.
        <p className="mt-3 border-t border-[#d8dde5] pt-3 text-xs font-bold text-[#64748b]">
          {otherDishes === 1
            ? t("kitchen.otherDishOne", { count: otherDishes })
            : t("kitchen.otherDishMany", { count: otherDishes })}
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-3 border-t border-[#d8dde5] pt-3">
          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            {otherItemCount === undefined
              ? t("kitchen.menuItemsOnEvent")
              : t("kitchen.yourDishesOnEvent")}
          </p>
          <ul className="mt-2 grid gap-1.5">
            {items.map((item, index) => (
              <li
                className="flex flex-wrap items-center gap-2 rounded-md bg-white px-2.5 py-2 text-xs font-bold text-[#17202a]"
                key={`${item.name}-${index}`}
              >
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="rounded-full bg-[#eef4fa] px-2 py-0.5 text-[10px] font-black text-[#1f4d73]">
                  {item.type}
                </span>
                {item.serviceStyle ? (
                  <span className="rounded-full bg-[#fef3c7] px-2 py-0.5 text-[10px] font-black text-[#92400e]">
                    {item.serviceStyle}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>

          {/* So a shortened list never reads as a smaller night. */}
          {otherDishes > 0 ? (
            <p className="mt-2 text-xs font-bold text-[#64748b]">
              and {otherDishes} other {otherDishes === 1 ? "dish" : "dishes"} on
              this event
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MiniChangeStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white px-2.5 py-2">
      <dt className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-black text-[#111827]">{value}</dd>
    </div>
  );
}
