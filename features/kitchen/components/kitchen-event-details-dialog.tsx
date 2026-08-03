"use client";

import { useState } from "react";
import {
  type KitchenEvent,
  type KitchenMenuItem,
  type KitchenResponse
} from "@/features/kitchen/components/kitchen-shared";

type KitchenItemActionInput =
  | {
      action: "status";
      eventId: string;
      menuItemId: string;
      status: "PENDING" | "COMPLETE";
    }
  | {
      action: "reset-status";
      eventId: string;
      menuItemId: string;
    }
  | {
      action: "assign-worker";
      eventId: string;
      menuItemId: string;
      assignedWorkerId: string | null;
    }
  | {
      action: "replace-menu-item";
      eventId: string;
      menuItemId: string;
      replacementMenuItemId: string;
    }
  | {
      action: "remove-menu-item";
      eventId: string;
      menuItemId: string;
    };

type KitchenPermissions = KitchenResponse["permissions"];

function nextStatus(status: KitchenMenuItem["status"]) {
  if (!status) return "PENDING";
  if (status === "PENDING") return "COMPLETE";
  return "COMPLETE";
}

function statusLabel(status: KitchenMenuItem["status"]) {
  if (status === "COMPLETE") return "Complete";
  if (status === "PENDING") return "Pending";
  return "Not started";
}

export function KitchenEventDetailsDialog({
  event,
  isSaving,
  menuItems,
  onClose,
  onSaveItemAction,
  permissions,
  workers
}: {
  event: KitchenEvent | null;
  isSaving: boolean;
  menuItems: KitchenResponse["menuItems"];
  onClose: () => void;
  onSaveItemAction: (input: KitchenItemActionInput) => Promise<void>;
  permissions: KitchenPermissions;
  workers: KitchenResponse["workers"];
}) {
  const [selectedItem, setSelectedItem] = useState<KitchenMenuItem | null>(null);
  const [replacementMenuItemId, setReplacementMenuItemId] = useState("");
  const [activeAction, setActiveAction] = useState<
    "choose" | "assign" | "replace"
  >("choose");

  if (!event) {
    return null;
  }

  const kitchenEvent = event;
  const hold = event.statusType === "hold";
  const productionItems =
    event.menuItems && event.menuItems.length > 0
      ? event.menuItems
      : [
          "Challah Rolls",
          "Gefilte Fish",
          "Chicken Soup",
          "Salad Topped with Salmon Cubes",
          "Vegetable Egg Roll on Sweet Potato Puree",
          "Chicken Capon Filled with Kishka",
          "Potato Kugel",
          "Roasted Vegetables",
          "Israeli Salad",
          "Assorted Dessert",
          "Cold Drinks"
        ].map((name, index) => ({
          id: `demo-${index}`,
          name,
          category: index < 3 ? "Mendy" : null,
          status: null,
          assignedWorkerId: null,
          assignedWorkerName: null
        }));

  async function handleStatusClick(item: KitchenMenuItem) {
    if (!permissions.canUpdateKitchenStatus || item.id.startsWith("demo-")) {
      setSelectedItem(item);
      return;
    }

    await onSaveItemAction({
      action: "status",
      eventId: kitchenEvent.id,
      menuItemId: item.id,
      status: nextStatus(item.status)
    });
  }

  async function handleItemDoubleClick(item: KitchenMenuItem) {
    if (!permissions.canUpdateKitchenStatus || item.id.startsWith("demo-")) {
      return;
    }

    await onSaveItemAction({
      action: "reset-status",
      eventId: kitchenEvent.id,
      menuItemId: item.id
    });
  }

  async function saveWorker(workerId: string | null) {
    if (!selectedItem) return;

    await onSaveItemAction({
      action: "assign-worker",
      eventId: kitchenEvent.id,
      menuItemId: selectedItem.id,
      assignedWorkerId: workerId
    });
    setSelectedItem(null);
    setActiveAction("choose");
  }

  async function replaceMenuItem() {
    if (!selectedItem || !replacementMenuItemId) return;

    await onSaveItemAction({
      action: "replace-menu-item",
      eventId: kitchenEvent.id,
      menuItemId: selectedItem.id,
      replacementMenuItemId
    });
    setSelectedItem(null);
    setReplacementMenuItemId("");
    setActiveAction("choose");
  }

  async function removeMenuItem() {
    if (!selectedItem) return;

    await onSaveItemAction({
      action: "remove-menu-item",
      eventId: kitchenEvent.id,
      menuItemId: selectedItem.id
    });
    setSelectedItem(null);
    setActiveAction("choose");
  }

  return (
    <div className="dashboard-drawer-backdrop fixed inset-0 z-100 flex items-center justify-center bg-[#07162d]/45 p-3 backdrop-blur-sm">
      <section
        aria-labelledby="kitchen-event-details-title"
        aria-modal="true"
        className="max-h-[calc(100dvh-24px)] w-full max-w-6xl overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-2xl shadow-[#07162d]/25"
        role="dialog"
      >
        <header className="flex items-start gap-3 border-b border-[#d8dde5] px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-wide text-[#617086]">
              Kitchen production details
            </p>
            <h2
              className="mt-1 truncate text-xl font-black text-[#07162d]"
              id="kitchen-event-details-title"
            >
              {event.title}
            </h2>
          </div>

          <button
            aria-label="Close kitchen event details"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-2xl leading-none text-[#17202a] transition hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="max-h-[calc(100dvh-104px)] overflow-y-auto bg-[#f5f6f8] p-4 sm:p-5">
          <div
            className={`mb-3 flex min-h-10 items-center justify-center rounded-lg px-4 text-center text-sm font-black uppercase tracking-wide text-white ${
              hold ? "bg-[#d88a00]" : "bg-[#1f4d73]"
            }`}
          >
            {event.status ?? (hold ? "On hold - not confirmed" : "Kitchen")}
          </div>

          <div className="grid gap-4 rounded-xl border border-[#d8dde5] bg-white p-4 lg:grid-cols-[250px_minmax(0,1fr)]">
            <aside className="border-l-4 border-[#1f4d73] bg-[#f8fafc] p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#617086]">
                {event.category}
              </p>
              <h3 className="mt-4 text-3xl font-black leading-tight text-[#07162d]">
                {event.title}
              </h3>
              <p className="mt-4 text-2xl font-black text-[#07162d]">
                {event.portions}
              </p>
              <p className="mt-6 text-sm font-black uppercase tracking-wide text-[#617086]">
                {event.packageName}
              </p>
            </aside>

            <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {productionItems.map((item) => {
                const isComplete = item.status === "COMPLETE";
                const isPending = item.status === "PENDING";

                return (
                  <button
                    className={`flex min-h-34 flex-col border bg-white p-3 text-center shadow-sm transition hover:border-[#1f4d73] hover:bg-[#eef4fa] ${
                      isComplete
                        ? "border-[#1fa368] bg-[#effcf5]"
                        : isPending
                          ? "border-[#d88a00] bg-[#fff6e8]"
                          : "border-[#d8dde5]"
                    }`}
                    disabled={isSaving}
                    key={item.id}
                    onClick={() => {
                      if (
                        permissions.canAssignWorkers ||
                        permissions.canEditMenu
                      ) {
                        setSelectedItem(item);
                        setActiveAction("choose");
                        setReplacementMenuItemId("");
                        return;
                      }

                      void handleStatusClick(item);
                    }}
                    onDoubleClick={() => void handleItemDoubleClick(item)}
                    type="button"
                  >
                    {item.assignedWorkerName ? (
                      <p className="mb-2 rounded-sm bg-[#0f5132] px-2 py-1 text-[10px] font-black text-white">
                        {item.assignedWorkerName}
                      </p>
                    ) : null}

                    <h4 className="text-base font-black leading-tight text-[#07162d]">
                      {item.name}
                    </h4>
                    <p className="mt-2 text-[11px] font-black leading-tight text-[#617086]">
                      {item.category ?? "Menu item"}
                    </p>
                    <div className="mt-auto pt-3">
                      <p className="border border-[#d8dde5] bg-[#eef4fa] px-2 py-1 text-xs font-black leading-tight text-[#07162d]">
                        {event.portions}
                      </p>
                      <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-[#617086]">
                        {statusLabel(item.status)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {selectedItem ? (
        <div className="fixed inset-0 z-110 flex items-center justify-center bg-[#07162d]/35 p-4">
          <section className="w-full max-w-md rounded-xl border border-[#d8dde5] bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b border-[#d8dde5] p-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-wide text-[#617086]">
                  Kitchen item
                </p>
                <h3 className="text-lg font-black text-[#07162d]">
                  {selectedItem.name}
                </h3>
              </div>
              <button
                className="text-2xl leading-none"
                onClick={() => setSelectedItem(null)}
                type="button"
              >
                ×
              </button>
            </header>

            <div className="space-y-3 p-4">
              {activeAction === "choose" ? (
                <>
                  {permissions.canAssignWorkers ? (
                    <button
                      className="h-11 w-full rounded-lg border border-[#b9c2cf] bg-white px-4 font-black text-[#07162d]"
                      onClick={() => setActiveAction("assign")}
                      type="button"
                    >
                      Assign worker
                    </button>
                  ) : null}

                  {permissions.canUpdateKitchenStatus ? (
                    <button
                      className="h-11 w-full rounded-lg bg-[#1f4d73] px-4 font-black text-white"
                      disabled={isSaving || selectedItem.id.startsWith("demo-")}
                      onClick={() => void handleStatusClick(selectedItem)}
                      type="button"
                    >
                      Move to {statusLabel(nextStatus(selectedItem.status))}
                    </button>
                  ) : null}

                  {permissions.canEditMenu ? (
                    <>
                      <button
                        className="h-11 w-full rounded-lg border border-[#b9c2cf] bg-white px-4 font-black text-[#07162d]"
                        onClick={() => setActiveAction("replace")}
                        type="button"
                      >
                        Replace menu item
                      </button>
                      <button
                        className="h-11 w-full rounded-lg border border-[#f0b9b4] bg-white px-4 font-black text-[#b42318]"
                        disabled={isSaving || selectedItem.id.startsWith("demo-")}
                        onClick={() => void removeMenuItem()}
                        type="button"
                      >
                        Remove item
                      </button>
                    </>
                  ) : null}
                </>
              ) : null}

              {activeAction === "assign" ? (
                <>
                  <button
                    className="h-10 w-full rounded-lg border border-[#b9c2cf] bg-white px-4 text-left font-black"
                    disabled={isSaving || selectedItem.id.startsWith("demo-")}
                    onClick={() => void saveWorker(null)}
                    type="button"
                  >
                    Unassign worker
                  </button>
                  {workers.map((worker) => (
                    <button
                      className="h-10 w-full rounded-lg border border-[#b9c2cf] bg-white px-4 text-left font-black hover:bg-[#eef4fa]"
                      disabled={isSaving || selectedItem.id.startsWith("demo-")}
                      key={worker.id}
                      onClick={() => void saveWorker(worker.id)}
                      type="button"
                    >
                      {worker.name}
                    </button>
                  ))}
                </>
              ) : null}

              {activeAction === "replace" ? (
                <>
                  <select
                    className="h-11 w-full rounded-lg border border-[#b9c2cf] px-3"
                    onChange={(event) =>
                      setReplacementMenuItemId(event.target.value)
                    }
                    value={replacementMenuItemId}
                  >
                    <option value="">Select replacement item</option>
                    {menuItems
                      .filter((item) => item.id !== selectedItem.id)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                  </select>
                  <button
                    className="h-11 w-full rounded-lg bg-[#1f4d73] px-4 font-black text-white disabled:opacity-50"
                    disabled={
                      isSaving ||
                      !replacementMenuItemId ||
                      selectedItem.id.startsWith("demo-")
                    }
                    onClick={() => void replaceMenuItem()}
                    type="button"
                  >
                    Save replacement
                  </button>
                </>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
