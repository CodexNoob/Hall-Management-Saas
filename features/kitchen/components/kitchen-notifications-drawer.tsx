"use client";

import { useMemo, useState } from "react";
import type { KitchenResponse } from "@/features/kitchen/components/kitchen-shared";

type KitchenNotificationFilter = "all" | "unacknowledged" | "acknowledged";
type KitchenNotification = KitchenResponse["notifications"][number];

const filters: Array<{
  id: KitchenNotificationFilter;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "unacknowledged", label: "Unacknowledged" },
  { id: "acknowledged", label: "Acknowledged" }
];

type KitchenNotificationsDrawerProps = {
  open: boolean;
  onClose: () => void;
  notifications: KitchenNotification[];
  onAcknowledge: (notificationId: string) => void | Promise<void>;
  acknowledgingId?: string | null;
};

export function KitchenNotificationsDrawer({
  acknowledgingId = null,
  notifications,
  open,
  onAcknowledge,
  onClose
}: KitchenNotificationsDrawerProps) {
  const [filter, setFilter] = useState<KitchenNotificationFilter>("all");

  const visibleNotifications = useMemo(() => {
    if (filter === "acknowledged") {
      return notifications.filter((item) => item.acknowledged);
    }
    if (filter === "unacknowledged") {
      return notifications.filter((item) => !item.acknowledged);
    }
    return notifications;
  }, [filter, notifications]);

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
              <span aria-hidden="true">🔔 </span>
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

        <div className="flex shrink-0 items-center gap-2 border-b border-[#e2e8f0] px-5 py-3">
          {filters.map((item) => (
            <button
              key={item.id}
              className={`h-8 border px-3 text-xs font-black ${
                filter === item.id
                  ? "border-[#061126] bg-[#061126] text-white"
                  : "border-[#cbd5e1] bg-[#f8fafc] text-[#475569] hover:bg-[#eef2f7]"
              }`}
              onClick={() => setFilter(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
          <p className="ml-auto text-xs font-black text-[#9aa4b2]">
            {notifications.length} records
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {visibleNotifications.length ? (
            <div className="grid gap-3">
              {visibleNotifications.map((notification) => (
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
              No kitchen notifications in this filter.
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
  return (
    <article className="border border-[#ff9b9b] bg-[#fff7f7] p-4 text-sm text-[#111827]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-black">{notification.title}</h3>
        <span
          className={`border px-2 py-1 text-xs font-black ${
            notification.acknowledged
              ? "border-[#86efac] bg-[#f0fdf4] text-[#166534]"
              : "border-[#ff9b9b] bg-[#ffecec] text-[#dc2626]"
          }`}
        >
          {notification.acknowledged ? "Acknowledged" : "⚠ Unacknowledged"}
        </span>
      </div>
      <p className="mt-4 font-black leading-6">{notification.description}</p>

      <dl className="mt-3 grid grid-cols-[48px_1fr] gap-x-4 gap-y-2">
        <Meta label="Event" value={notification.event} />
        <Meta label="Hall" value={notification.hall} />
        <Meta label="Date" value={notification.date} />
        <Meta label="Old" value={notification.oldValue} />
        <Meta label="New" value={notification.newValue} />
        <Meta label="By" value={notification.by} />
        <Meta label="When" value={notification.when} />
      </dl>

      {(notification.acknowledgedBy || notification.emailSent) ? (
        <div className="mt-3 border-t border-[#d8dde5] pt-3">
          {notification.acknowledgedBy ? (
            <>
              <p className="text-xs font-black uppercase tracking-[0.05em] text-[#64748b]">
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

      {!notification.acknowledged ? (
        <button
          className="mt-4 h-9 border border-[#061126] bg-[#061126] px-3 text-xs font-black text-white hover:bg-[#16243a] disabled:cursor-wait disabled:opacity-60"
          disabled={acknowledging}
          onClick={() => void onAcknowledge(notification.id)}
          type="button"
        >
          {acknowledging ? "Acknowledging..." : "Acknowledge"}
        </button>
      ) : null}
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-xs font-black uppercase tracking-[0.06em] text-[#64748b]">
        {label}
      </dt>
      <dd className="text-xs font-semibold text-[#111827]">{value}</dd>
    </>
  );
}
