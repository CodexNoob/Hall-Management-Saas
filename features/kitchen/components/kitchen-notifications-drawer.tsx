"use client";

import { useState } from "react";
import type { KitchenResponse } from "@/features/kitchen/components/kitchen-shared";

type KitchenNotification = KitchenResponse["notifications"][number];

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
  open: boolean;
  onClose: () => void;
  notifications: KitchenNotification[];
  onAcknowledge: (notificationId: string) => void | Promise<void>;
  onAcknowledgeAll: () => void | Promise<void>;
  onClearNotifications: () => void | Promise<void>;
  acknowledgingId?: string | null;
  bulkAction?: "acknowledge-all" | "clear" | null;
};

export function KitchenNotificationsDrawer({
  acknowledgmentError = null,
  acknowledgingId = null,
  bulkAction = null,
  notifications,
  open,
  onAcknowledge,
  onAcknowledgeAll,
  onClearNotifications,
  onClose
}: KitchenNotificationsDrawerProps) {
  const hasUnacknowledged = notifications.some((item) => !item.acknowledged);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-100 bg-[#061126]/55">
      <aside
        aria-label="Kitchen Notifications"
        aria-modal="true"
        className="fixed bottom-0 right-0 top-0 z-101 flex w-full max-w-130 flex-col bg-white shadow-2xl shadow-black/30"
        role="dialog"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 bg-[#061126] px-5 py-4 text-white">
          <div>
            <h2 className="text-xl font-black leading-tight">
              <BellIcon />
              Kitchen Notifications
            </h2>
            <p className="mt-1 text-sm font-semibold text-[#cbd5e1]">
              Change history &amp; acknowledgments
            </p>
          </div>
          <button
            aria-label="Close kitchen notifications"
            className="flex h-11 w-11 items-center justify-center border border-[#44536a] text-3xl leading-none text-white hover:bg-white/10"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="flex shrink-0 flex-wrap gap-2 border-b border-[#e2e8f0] px-5 py-3">
          <button
            className="h-9 border border-[#061126] bg-[#061126] px-3 text-xs font-black text-white hover:bg-[#16243a] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!hasUnacknowledged || bulkAction !== null}
            onClick={() => void onAcknowledgeAll()}
            type="button"
          >
            {bulkAction === "acknowledge-all"
              ? "Acknowledging..."
              : "Acknowledge all"}
          </button>
          <button
            className="h-9 border border-[#efb5ad] bg-white px-3 text-xs font-black text-[#b42318] hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={notifications.length === 0 || bulkAction !== null}
            onClick={() => {
              if (
                window.confirm(
                  "Clear all kitchen notifications? This cannot be undone."
                )
              ) {
                void onClearNotifications();
              }
            }}
            type="button"
          >
            {bulkAction === "clear" ? "Clearing..." : "Clear notifications"}
          </button>
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

          {notifications.length ? (
            <div className="grid gap-3">
              {notifications.map((notification) => (
                <NotificationCard
                  acknowledging={acknowledgingId === notification.id}
                  key={notification.id}
                  notification={notification}
                  onAcknowledge={onAcknowledge}
                />
              ))}
            </div>
          ) : (
            <div className="border border-[#d8dde5] bg-[#f8fafc] px-4 py-8 text-center text-sm font-bold text-[#64748b]">
              No kitchen notifications.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function NotificationCard({
  acknowledging,
  onAcknowledge,
  notification
}: {
  acknowledging: boolean;
  onAcknowledge: (notificationId: string) => void | Promise<void>;
  notification: KitchenNotification;
}) {
  const [showChanges, setShowChanges] = useState(false);
  const changedItem =
    notification.title === "Menu Changed"
      ? "Menu status"
      : notification.title === "Sudden Event"
        ? "Event schedule"
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
              <AlertIcon /> Unacknowledged
            </>
          )}
        </span>
      </div>
      <p className="mt-4 font-black leading-6">{notification.description}</p>

      {showChanges ? (
        <section className="mt-3 border border-[#d8dde5] bg-white p-3">
          <h4 className="text-xs font-black uppercase tracking-[0.06em] text-[#1f4d73]">
            Change made by Event Manager
          </h4>

          <dl className="mt-3 grid gap-3">
            <Meta label="Event" value={notification.event} />
            <Meta label="Hall" value={notification.hall} />
            <Meta label="Date" value={notification.date} />
            <Meta label="Changed item" value={changedItem} />
            <CleanChangeSummary notification={notification} />
            <Meta label="Changed by" value={notification.by} />
            <Meta label="Changed at" value={notification.when} />
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
          Kitchen response
        </p>
        <p className="mt-1 text-sm font-black text-[#17202a]">
          {notification.acknowledgedBy
            ? `${notification.acknowledgedBy}${
                notification.acknowledgedAt
                  ? ` — ${notification.acknowledgedAt}`
                  : ""
              }`
            : "Waiting for kitchen acknowledgment"}
        </p>
      </div>

      {notification.emailSent ? (
        <p className="mt-3 text-xs font-semibold text-[#0284c7]">
          Email: {notification.emailSent}
        </p>
      ) : null}

      {notification.acknowledgedBy || notification.emailSent ? (
        <div className="sr-only">
          {notification.acknowledgedBy ? (
            <>
              <p className="text-xs font-black uppercase tracking-wider text-[#64748b]">
                Acknowledged by:
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

          {notification.emailSent ? (
            <p className="mt-3 text-xs font-semibold text-[#0284c7]">
              ◉ {notification.emailSent}
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
          {showChanges ? "Hide changes" : "View changes"}
        </button>

        {!notification.acknowledged ? (
          <button
            className="h-10 flex-1 border border-[#061126] bg-[#061126] px-4 text-xs font-black text-white hover:bg-[#16243a] disabled:cursor-wait disabled:opacity-60 sm:flex-none"
            disabled={acknowledging}
            onClick={() => void onAcknowledge(notification.id)}
            type="button"
          >
            {acknowledging ? "Saving acknowledgment..." : "Acknowledge now"}
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
  if (!notification.changeSummary) {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <ChangeValue label="Before" value={notification.oldValue} />
        <ChangeValue label="After" value={notification.newValue} />
      </div>
    );
  }

  const { afterStatus, beforeStatus, items, meal } = notification.changeSummary;

  return (
    <div className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <MiniChangeStat label="Before" value={beforeStatus ?? "—"} />
        <MiniChangeStat label="After" value={afterStatus ?? "—"} />
        <MiniChangeStat label="Meal" value={meal ?? "—"} />
      </div>

      {items.length > 0 ? (
        <div className="mt-3 border-t border-[#d8dde5] pt-3">
          <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">
            Menu items now on this event
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
